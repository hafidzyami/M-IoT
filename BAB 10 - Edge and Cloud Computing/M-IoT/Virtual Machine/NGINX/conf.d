server {
    listen 80;
    server_name miot.profybandung.cloud;

    # Pengalihan permanen ke versi HTTPS yang aman
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name miot.profybandung.cloud;

    # Path ke sertifikat SSL yang dibuat oleh Certbot
    ssl_certificate /etc/letsencrypt/live/miot.profybandung.cloud/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/miot.profybandung.cloud/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root /var/www/miot;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # Blok SPESIFIK untuk WebRTC (WHEP).
    location ~ ^/([a-zA-Z0-9_-]+)/whep$ {
        proxy_pass http://127.0.0.1:8889;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Blok UMUM untuk HLS
    location ~ ^/([a-zA-Z0-9_-]+)/ {
        proxy_pass http://127.0.0.1:8888;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}