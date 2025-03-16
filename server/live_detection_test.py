import cv2
import torch
import numpy as np
import matplotlib.pyplot as plt
from collections import deque
from torchvision import transforms
from PIL import Image
from approach.ResEmoteNet import ResEmoteNet  # Adjust import if needed

# ✅ Set Device (Use MPS for Mac GPU)
device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
print(f"🔥 Using device: {device}")

# ✅ Load Pre-trained Model
model_path = "best_finetuned_ResEmoteNet.pth"  # Update path if necessary
model = ResEmoteNet().to(device)
model.load_state_dict(torch.load(model_path, map_location=device))
model.eval()
print("✅ Model Loaded Successfully")

# ✅ Define Transformations
transform = transforms.Compose([
    transforms.Grayscale(num_output_channels=3),
    transforms.Resize((48, 48)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5])
])

# ✅ Define Class Labels & Emotion Weights for Valence Calculation
class_labels = ['angry', 'disgust', 'fear', 'happy', 'neutral', 'sad', 'surprise']
valence_weights = [-0.8, -0.7, -0.6, 0.8, 0, -0.5, 0.7]  # Approximate Valence Scores
engagement_weights = [0.6, 0.8, 0.7, 1.0, 0.3, 0.5, 0.9]  # Expressiveness Scores

# ✅ Load Face Detector
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

# ✅ Initialize Emotion History (Smoothing)
emotion_history = deque(maxlen=10)  # Store last 10 predictions to smooth results
valence_history = deque(maxlen=10)  # Store valence history
engagement_history = deque(maxlen=10)  # Store engagement history
emotion_trends = {emotion: deque(maxlen=50) for emotion in class_labels}  # For plotting trends

# ✅ Initialize Matplotlib Figure with Separate Subplots
plt.ion()  # Interactive mode
fig, axes = plt.subplots(len(class_labels), 1, figsize=(8, 12), sharex=True)

# ✅ Initialize Webcam
cap = cv2.VideoCapture(0)  # Default webcam

if not cap.isOpened():
    print("❌ Error: Could not open webcam.")
    exit()

print("🎥 Live Detection Started! Press 'q' to exit.")

while True:
    ret, frame = cap.read()
    if not ret:
        print("❌ Failed to capture frame")
        break

    # Convert frame to grayscale for face detection
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # Detect faces
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=6, minSize=(60, 60))

    for (x, y, w, h) in faces:
        face_roi = frame[y:y + h, x:x + w]  # Extract face region
        
        # Convert to PIL Image for processing
        face_pil = Image.fromarray(cv2.cvtColor(face_roi, cv2.COLOR_BGR2RGB))

        # Apply transformations & move to GPU
        face_tensor = transform(face_pil).unsqueeze(0).to(device)  # Add batch dimension

        # Predict emotions
        with torch.no_grad():
            output = model(face_tensor.to(device))
            probabilities = torch.nn.functional.softmax(output, dim=1).cpu().numpy()[0]  # Convert to probabilities

        # Update Emotion Trends for Graphing
        for i, emotion in enumerate(class_labels):
            emotion_trends[emotion].append(probabilities[i] * 100)

        # Get the **Top-1 emotion** and smooth over last 10 predictions
        top_index = np.argmax(probabilities)
        emotion_history.append(top_index)

        # **Smooth Emotion by Majority Vote**
        most_common_emotion = max(set(emotion_history), key=emotion_history.count)
        emotion = class_labels[most_common_emotion]
        confidence = probabilities[most_common_emotion] * 100

        # ✅ Calculate Valence & Engagement
        valence = sum(probabilities[i] * valence_weights[i] for i in range(len(class_labels)))
        engagement = sum(probabilities[i] * engagement_weights[i] for i in range(len(class_labels)))

        # Smooth Values
        valence_history.append(valence)
        engagement_history.append(engagement)
        avg_valence = np.mean(valence_history)
        avg_engagement = np.mean(engagement_history) * 100  # Convert to %

        # ✅ Draw Advanced Bounding Box with Soft Glow
        overlay = frame.copy()
        cv2.rectangle(overlay, (x, y), (x + w, y + h), (255, 255, 255), 3)  # White bounding box
        alpha = 0.4  # Transparency effect
        frame = cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0)

        # ✅ Display All Emotions with Percentage Bars
        y_offset = y - 70
        for i, emotion_name in enumerate(class_labels):
            emotion_prob = int(probabilities[i] * 100)
            bar_length = int(150 * (emotion_prob / 100))

            # Draw Bars
            cv2.rectangle(frame, (x + 5, y_offset), (x + 5 + bar_length, y_offset + 15), (255, 255, 255), -1)
            cv2.putText(frame, f"{emotion_name}: {emotion_prob}%", (x + 160, y_offset + 12),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)
            y_offset += 20  # Spacing

        # ✅ Display Stabilized Valence & Engagement
        cv2.putText(frame, f"Valence: {avg_valence:.2f}", (x + 5, y_offset + 10), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        cv2.putText(frame, f"Engagement: {avg_engagement:.1f}%", (x + 5, y_offset + 30), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

    # Show real-time detection
    cv2.imshow("Facial Emotion Detection (MacOS GPU)", frame)

    # ✅ Real-Time Emotion Trend Graph (Each Emotion in Separate Plot)
    for i, emotion in enumerate(class_labels):
        axes[i].clear()
        axes[i].plot(emotion_trends[emotion], label=emotion, color="C" + str(i))
        axes[i].set_ylim(0, 100)
        axes[i].set_ylabel(emotion, fontsize=10)
        axes[i].legend(loc="upper right")

    axes[-1].set_xlabel("Time")
    fig.suptitle("Real-Time Emotion Trends", fontsize=12)
    plt.pause(0.01)  # Refresh graph

    # Exit when 'q' is pressed
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# ✅ Cleanup
cap.release()
cv2.destroyAllWindows()
plt.ioff()  # Turn off interactive mode
plt.show()  # Display final graph
print("🔄 Webcam Closed Successfully.")
