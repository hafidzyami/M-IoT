#include <string.h>
#include <sys/socket.h>
#include <malloc.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "freertos/queue.h"

#include "esp_log.h"
#include "esp_wifi.h"
#include "esp_event.h"

#include "nvs_flash.h"

#include "protocol_examples_common.h"

#include "coap3/coap.h"

#include "esp_camera.h"

#ifndef CONFIG_COAP_SERVER_SUPPORT
#error COAP_SERVER_SUPPORT needs to be enabled
#endif /* COAP_SERVER_SUPPORT */

#define EXAMPLE_COAP_PSK_KEY CONFIG_EXAMPLE_COAP_PSK_KEY
#define EXAMPLE_COAP_LOG_DEFAULT_LEVEL CONFIG_COAP_LOG_DEFAULT_LEVEL

#define COAP_MEDIATYPE_IMAGE_JPEG 25

const static char *TAG = "CoAP_server";

static QueueHandle_t camera_frame_queue = NULL;
static camera_fb_t *g_latest_fb = NULL;

static bool streaming_active = false;
static coap_resource_t *stream_resource = NULL;
static TaskHandle_t stream_task_handle = NULL;

/* --- KONFIGURASI KAMERA --- */
#define CAM_PIN_PWDN -1
#define CAM_PIN_RESET -1
#define CAM_PIN_XCLK 21
#define CAM_PIN_SIOD 26
#define CAM_PIN_SIOC 27
#define CAM_PIN_D7 35
#define CAM_PIN_D6 34
#define CAM_PIN_D5 39
#define CAM_PIN_D4 36
#define CAM_PIN_D3 19
#define CAM_PIN_D2 18
#define CAM_PIN_D1 5
#define CAM_PIN_D0 4
#define CAM_PIN_VSYNC 25
#define CAM_PIN_HREF 23
#define CAM_PIN_PCLK 22

static camera_config_t camera_config = {
    .pin_pwdn = CAM_PIN_PWDN, 
    .pin_reset = CAM_PIN_RESET, 
    .pin_xclk = CAM_PIN_XCLK, 
    .pin_sccb_sda = CAM_PIN_SIOD, 
    .pin_sccb_scl = CAM_PIN_SIOC, 
    .pin_d7 = CAM_PIN_D7, 
    .pin_d6 = CAM_PIN_D6, 
    .pin_d5 = CAM_PIN_D5, 
    .pin_d4 = CAM_PIN_D4, .pin_d3 = CAM_PIN_D3, .pin_d2 = CAM_PIN_D2, .pin_d1 = CAM_PIN_D1, .pin_d0 = CAM_PIN_D0, .pin_vsync = CAM_PIN_VSYNC, .pin_href = CAM_PIN_HREF, .pin_pclk = CAM_PIN_PCLK, .xclk_freq_hz = 20000000, .ledc_timer = LEDC_TIMER_0, .ledc_channel = LEDC_CHANNEL_0, .pixel_format = PIXFORMAT_JPEG, .frame_size = FRAMESIZE_VGA, .jpeg_quality = 50, .fb_count = 2, .grab_mode = CAMERA_GRAB_WHEN_EMPTY};

esp_err_t camera_init()
{
    esp_err_t err = esp_camera_init(&camera_config);
    if (err != ESP_OK)
    {
        ESP_LOGE(TAG, "Camera Init Failed");
        return err;
    }
    return ESP_OK;
}

camera_fb_t *capture_frame()
{
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb)
    {
        ESP_LOGW(TAG, "Camera capture failed (esp_camera_fb_get returned NULL)");
        return NULL;
    }
    return fb;
}

/* --- HANDLER RESOURCE --- */

// Callback untuk membebaskan memori salinan data setelah dikirim
static void free_coap_data_copy(coap_session_t *session, void *app_ptr)
{
    if (app_ptr)
    {
        ESP_LOGD(TAG, "Freeing data copy at %p", app_ptr);
        free(app_ptr);
    }
}

// Handler GET untuk /stream
static void hnd_camera_stream_get(coap_resource_t *resource, coap_session_t *session,
                                  const coap_pdu_t *request, const coap_string_t *query,
                                  coap_pdu_t *response)
{
    if (streaming_active && g_latest_fb)
    {
        // Buat salinan data yang stabil untuk transfer ini
        uint8_t *data_copy = malloc(g_latest_fb->len);
        if (data_copy)
        {
            ESP_LOGD(TAG, "Allocated %d bytes for frame copy at %p", g_latest_fb->len, data_copy);
            memcpy(data_copy, g_latest_fb->buf, g_latest_fb->len);

            coap_pdu_set_code(response, COAP_RESPONSE_CODE_CONTENT);

            // Kirim salinan data dan berikan callback untuk membebaskan memori
            coap_add_data_large_response(resource, session, request, response,
                                         query, COAP_MEDIATYPE_IMAGE_JPEG, -1, 0,
                                         g_latest_fb->len, data_copy,
                                         free_coap_data_copy, data_copy);
        }
        else
        {
            ESP_LOGE(TAG, "Failed to allocate %d bytes for frame copy!", g_latest_fb->len);
            coap_pdu_set_code(response, COAP_RESPONSE_CODE_INTERNAL_ERROR);
        }
    }
    else
    {
        // Kirim status jika tidak ada frame
        const char *status_msg = streaming_active ? "{\"status\":\"streaming\",\"active\":true,\"detail\":\"waiting for frame\"}" : "{\"status\":\"stopped\",\"active\":false}";
        coap_pdu_set_code(response, COAP_RESPONSE_CODE_CONTENT);
        unsigned char mediatype_buf[2];
        coap_add_option(response, COAP_OPTION_CONTENT_FORMAT,
                        coap_encode_var_safe(mediatype_buf, sizeof(mediatype_buf), COAP_MEDIATYPE_APPLICATION_JSON),
                        mediatype_buf);
        coap_add_data(response, strlen(status_msg), (const uint8_t *)status_msg);
    }
}

// Handler untuk /capture
static void hnd_camera_capture(coap_resource_t *resource, coap_session_t *session,
                               const coap_pdu_t *request, const coap_string_t *query,
                               coap_pdu_t *response)
{
    ESP_LOGI(TAG, "Camera capture requested");
    if (streaming_active && g_latest_fb)
    {
        coap_pdu_set_code(response, COAP_RESPONSE_CODE_CONTENT);
        coap_add_data_large_response(resource, session, request, response,
                                     query, COAP_MEDIATYPE_IMAGE_JPEG, 60, 0,
                                     g_latest_fb->len, g_latest_fb->buf,
                                     NULL, NULL);
    }
    else
    {
        ESP_LOGE(TAG, "Capture failed: Stream is not active.");
        coap_pdu_set_code(response, COAP_RESPONSE_CODE_SERVICE_UNAVAILABLE);
    }
}

// Task stream hanya menangkap frame dan mengirimnya via queue
static void camera_stream_task(void *pvParameters)
{
    ESP_LOGI(TAG, "Camera stream task started");
    while (streaming_active)
    {
        camera_fb_t *fb = capture_frame();
        if (fb)
        {
            if (xQueueSend(camera_frame_queue, &fb, (TickType_t)0) != pdPASS)
            {
                esp_camera_fb_return(fb);
            }
        }
        vTaskDelay(pdMS_TO_TICKS(100)); // Target ~10 FPS
    }
    ESP_LOGI(TAG, "Camera stream task ended");
    stream_task_handle = NULL;
    vTaskDelete(NULL);
}

// Handler PUT untuk /stream (start/stop)
static void hnd_camera_stream_put(coap_resource_t *resource, coap_session_t *session,
                                  const coap_pdu_t *request, const coap_string_t *query,
                                  coap_pdu_t *response)
{
    size_t size;
    const unsigned char *data;
    coap_get_data(request, &size, &data);

    if (size > 0)
    {
        if (strncmp((char *)data, "start", size) == 0)
        {
            if (!streaming_active)
            {
                streaming_active = true;
                xTaskCreate(camera_stream_task, "camera_stream", 4096, NULL, 5, &stream_task_handle);
                ESP_LOGI(TAG, "Stream start command received");
            }
            coap_pdu_set_code(response, COAP_RESPONSE_CODE_CHANGED);
        }
        else if (strncmp((char *)data, "stop", size) == 0)
        {
            if (streaming_active)
            {
                streaming_active = false;
                ESP_LOGI(TAG, "Stream stop command received");
            }
            coap_pdu_set_code(response, COAP_RESPONSE_CODE_CHANGED);
        }
        else
        {
            coap_pdu_set_code(response, COAP_RESPONSE_CODE_BAD_REQUEST);
        }
    }
    else
    {
        coap_pdu_set_code(response, COAP_RESPONSE_CODE_BAD_REQUEST);
    }
}

/* --- FUNGSI UTAMA SERVER COAP --- */
static void coap_example_server(void *p)
{
    coap_context_t *ctx = NULL;
    coap_address_t serv_addr;

    coap_set_log_level(EXAMPLE_COAP_LOG_DEFAULT_LEVEL);

    while (1)
    {
        coap_address_init(&serv_addr);
        serv_addr.addr.sin6.sin6_family = AF_INET6;
        serv_addr.addr.sin6.sin6_port = htons(COAP_DEFAULT_PORT);
        ctx = coap_new_context(NULL);
        if (!ctx)
        {
            ESP_LOGE(TAG, "coap_new_context() failed");
            continue;
        }

        coap_context_set_block_mode(ctx, COAP_BLOCK_USE_LIBCOAP | COAP_BLOCK_SINGLE_BODY);

        if (!coap_new_endpoint(ctx, &serv_addr, COAP_PROTO_UDP))
        {
            ESP_LOGE(TAG, "udp endpoint setup failed");
            goto clean_up;
        }

        // Inisialisasi resource stream
        stream_resource = coap_resource_init(coap_make_str_const("stream"), 0);
        coap_register_handler(stream_resource, COAP_REQUEST_GET, hnd_camera_stream_get);
        coap_register_handler(stream_resource, COAP_REQUEST_PUT, hnd_camera_stream_put);
        coap_resource_set_get_observable(stream_resource, 1);
        coap_add_resource(ctx, stream_resource);

        // Inisialisasi resource capture
        coap_resource_t *capture_resource = coap_resource_init(coap_make_str_const("capture"), 0);
        coap_register_handler(capture_resource, COAP_REQUEST_GET, hnd_camera_capture);
        coap_add_resource(ctx, capture_resource);

        ESP_LOGI(TAG, "CoAP server started.");

        while (1)
        {
            int result = coap_io_process(ctx, 100);
            if (result < 0)
            {
                break;
            }

            camera_fb_t *fb_from_queue = NULL;
            if (xQueueReceive(camera_frame_queue, &fb_from_queue, (TickType_t)0) == pdPASS)
            {
                if (g_latest_fb)
                {
                    esp_camera_fb_return(g_latest_fb);
                }
                g_latest_fb = fb_from_queue;

                if (g_latest_fb)
                {
                    ESP_LOGD(TAG, "New frame in queue, marking resource dirty");
                    coap_resource_set_dirty(stream_resource, NULL);
                }
            }
        }
    }
clean_up:
    if (streaming_active)
    {
        streaming_active = false;
        vTaskDelay(pdMS_TO_TICKS(200));
    }
    if (g_latest_fb)
    {
        esp_camera_fb_return(g_latest_fb);
        g_latest_fb = NULL;
    }
    coap_free_context(ctx);
    coap_cleanup();
    vTaskDelete(NULL);
}

void app_main(void)
{
    ESP_ERROR_CHECK(nvs_flash_init());
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    ESP_ERROR_CHECK(example_connect());

    if (camera_init() != ESP_OK)
    {
        return;
    }

    camera_frame_queue = xQueueCreate(1, sizeof(camera_fb_t *));
    if (!camera_frame_queue)
    {
        ESP_LOGE(TAG, "Failed to create queue");
        return;
    }

    xTaskCreate(coap_example_server, "coap", 8 * 1024, NULL, 5, NULL);
}
