import cv2

def display_camera():
    cap = cv2.VideoCapture(0)

    # Lower resolution might increase frame rate
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    if not cap.isOpened():
        print("Error: Could not open camera")
        return

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("Error: Can't receive frame (stream end?). Exiting ...")
                break

            cv2.imshow('Camera Output', frame)

            # The '1' in waitKey is a millisecond delay time. Lowering this can increase perceived frame rate.
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()

if __name__ == '__main__':
    display_camera()
