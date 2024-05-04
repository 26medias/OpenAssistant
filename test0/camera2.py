import av
import pygame
import sys
from pygame.locals import QUIT

def main():
    # Pygame setup
    pygame.init()
    window_size = (640, 480)
    window = pygame.display.set_mode(window_size)
    pygame.display.set_caption('USB Camera Stream')

    # Open the USB camera (usually /dev/video0)
    camera = av.open('/dev/video0')

    # Main loop to display each frame
    try:
        for frame in camera.decode(video=0):
            for event in pygame.event.get():
                if event.type == QUIT:
                    pygame.quit()
                    sys.exit()
            
            # Convert the frame to a pygame-compatible surface
            img = frame.to_image()  # Get PIL image from PyAV frame
            mode = img.mode
            size = img.size
            data = img.tobytes()

            # Create a pygame Surface from raw pixel data
            py_image = pygame.image.fromstring(data, size, mode)

            # Resize to fit the window
            py_image = pygame.transform.scale(py_image, window_size)

            # Display the image
            window.blit(py_image, (0, 0))
            pygame.display.flip()
            pygame.time.wait(50)  # control playback speed / frame rate

    except KeyboardInterrupt:
        pass

    finally:
        camera.close()
        pygame.quit()

if __name__ == '__main__':
    main()
