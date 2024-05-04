#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <fcntl.h>
#include <unistd.h>
#include <sys/ioctl.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <linux/videodev2.h>
#include <jpeglib.h>

#define WIDTH 640
#define HEIGHT 480
#define PORT 8086

int open_camera(const char *device) {
    int fd = open(device, O_RDWR);
    if (fd == -1) {
        perror("Opening video device");
        return -1;
    }
    return fd;
}

int init_camera(int fd) {
    struct v4l2_format format;
    memset(&format, 0, sizeof(format));
    format.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
    format.fmt.pix.pixelformat = V4L2_PIX_FMT_MJPEG;
    format.fmt.pix.width = WIDTH;
    format.fmt.pix.height = HEIGHT;

    if (ioctl(fd, VIDIOC_S_FMT, &format) == -1) {
        perror("Setting Pixel Format");
        return -1;
    }
    return 0;
}

void capture_image(int fd, unsigned char **buffer, int *buffer_size) {
    struct v4l2_buffer buf;
    memset(&buf, 0, sizeof(buf));
    buf.type = V4L2_BUF_TYPE_VIDEO_CAPTURE;
    buf.memory = V4L2_MEMORY_MMAP;
    ioctl(fd, VIDIOC_DQBUF, &buf);

    *buffer = (unsigned char*)malloc(buf.length);
    memcpy(*buffer, buf.m.userptr, buf.length);
    *buffer_size = buf.length;

    ioctl(fd, VIDIOC_QBUF, &buf);
}

void compress_frame(unsigned char *in_buffer, int in_size, unsigned char **out_buffer, unsigned long *out_size) {
    struct jpeg_compress_struct cinfo;
    struct jpeg_error_mgr jerr;

    cinfo.err = jpeg_std_error(&jerr);
    jpeg_create_compress(&cinfo);
    jpeg_mem_dest(&cinfo, out_buffer, out_size);

    cinfo.image_width = WIDTH;
    cinfo.image_height = HEIGHT;
    cinfo.input_components = 3;
    cinfo.in_color_space = JCS_RGB;

    jpeg_set_defaults(&cinfo);
    jpeg_start_compress(&cinfo, TRUE);

    // Add image data

    jpeg_finish_compress(&cinfo);
    jpeg_destroy_compress(&cinfo);
}

int create_server(int port) {
    int server_fd = socket(AF_INET, SOCK_STREAM, 0);
    struct sockaddr_in address;
    int opt = 1;

    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR | SO_REUSEPORT, &opt, sizeof(opt));
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(port);

    bind(server_fd, (struct sockaddr *)&address, sizeof(address));
    listen(server_fd, 5);
    return server_fd;
}

void server_loop(int camera_fd, int server_fd) {
    struct sockaddr_in client;
    int client_len = sizeof(client);
    int client_fd = accept(server_fd, (struct sockaddr *)&client, (socklen_t*)&client_len);

    while (1) {
        unsigned char *frame_buffer;
        int frame_size;
        capture_image(camera_fd, &frame_buffer, &frame_size);

        unsigned char *jpeg_buffer = NULL;
        unsigned long jpeg_size = 0;
        compress_frame(frame_buffer, frame_size, &jpeg_buffer, &jpeg_size);

        send(client_fd, jpeg_buffer, jpeg_size, 0);

        free(frame_buffer);
        free(jpeg_buffer);
    }
}

int main() {
    int camera_fd = open_camera("/dev/video0");
    if (camera_fd == -1) return -1;

    if (init_camera(camera_fd) == -1) {
        close(camera_fd);
        return -1;
    }

    int server_fd = create_server(PORT);
    printf("Server started on port %d\n", PORT);
    server_loop(camera_fd, server_fd);

    close(camera_fd);
    return 0;
}
