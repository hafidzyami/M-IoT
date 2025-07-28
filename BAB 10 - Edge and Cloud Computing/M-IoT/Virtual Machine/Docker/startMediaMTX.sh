sudo docker run -d --name mediamtx \
-v ~/mediamtx.yml:/mediamtx.yml \
-p 1935:1935 \
-p 8888:8888 \
-p 8889:8889 \
-p 8890:8890/udp \
-p 8189:8189/udp \
bluenviron/mediamtx:latest