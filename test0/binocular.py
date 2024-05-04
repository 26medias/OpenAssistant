import cv2
import numpy as np

def display_cameras_side_by_side():
    # Initialize two camera capture objects
    cap1 = cv2.VideoCapture(0)  # First camera
    cap2 = cv2.VideoCapture(1)  # Second camera

    # Check if cameras are opened successfully
    if not (cap1.isOpened() and cap2.isOpened()):
        print("Error: Could not open one or both cameras")
        return

    # Set resolution for both cameras (if needed, ensure your camera supports these resolutions)
    cap1.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap1.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    cap2.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap2.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    try:
        while True:
            # Capture frame-by-frame from both cameras
            ret1, frame1 = cap1.read()
            ret2, frame2 = cap2.read()

            if not ret1 or not ret2:
                print("Error: Can't receive frame from one of the cameras. Exiting ...")
                break

            # Concatenate images horizontally
            combined_frame = np.hstack((frame1, frame2))

            # Display the resulting frame
            cv2.imshow('Binocular View', combined_frame)

            # Press 'q' on the keyboard to exit
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
    finally:
        # When everything done, release the capture
        cap1.release()
        cap2.release()
        cv2.destroyAllWindows()

if __name__ == '__main__':
    display_cameras_side_by_side()
