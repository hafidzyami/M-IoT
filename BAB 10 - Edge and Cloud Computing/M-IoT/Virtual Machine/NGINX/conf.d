server {
    listen 80;
    server_name miot.profybandung.cloud;

    # Pengalihan permanen ke versi HTTPS yang aman
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name miot.profybandung.cloud;

    ssl_certificate /etc/letsencrypt/live/miot.profybandung.cloud/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/miot.profybandung.cloud/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root /var/www/miot;
    index index.html;

    # 1. Handle actual website files first
    location / {
        try_files $uri $uri/ =404;
    }

    # 2. WebRTC (WHEP) - Explicit and low latency
    # WHEP is plain HTTP POST, not WebSocket — do not send Upgrade headers.
    # Expose Location/Link so the browser can read the WHEP session resource URL.
    location /webrtc/ {
        proxy_pass http://127.0.0.1:8889/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Expose-Headers' 'Location, Link' always;
    }

    # 3. HLS - Using a prefix to avoid catching static assets
    location /hls/ {
        proxy_pass http://127.0.0.1:8888/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        add_header 'Access-Control-Allow-Origin' '*' always;
    }
}