# OpenAssistant
 
python audio.py --token API_KEY --file test.wav



cvlc v4l2:///dev/video0:chroma=h264:width=1280:height=720 --sout '#transcode{vcodec=h264,vb=800,scale=1.0,acodec=none}:http{mux=ffmpeg{mux=flv},dst=:8088/}' -I dummy

ffmpeg -f v4l2 -i /dev/video0 -c:v libx264 -preset veryfast -maxrate 2000k -bufsize 4000k -vf "fps=20,scale=1280:-1" -g 40 -tune zerolatency -f rtsp rtsp://localhost:8088/mystream