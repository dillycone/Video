import cv2
import numpy as np
from pathlib import Path
import base64
import json
import sys
from typing import List, Dict, Tuple, Optional

def extract_key_frames(video_path: str, num_frames: int = 5) -> List[Dict[str, str]]:
    """
    Extract key frames from a video file.
    Returns a list of dictionaries containing frame data and timestamps.
    """
    print(f"Opening video file: {video_path}", file=sys.stderr)
    cap = cv2.VideoCapture(str(video_path))
    
    if not cap.isOpened():
        raise ValueError(f"Failed to open video file: {video_path}")
    
    # Get video properties
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    duration = total_frames / fps
    
    print(f"Video properties: frames={total_frames}, fps={fps}, duration={duration:.2f}s", file=sys.stderr)
    
    # Calculate frame positions to extract (evenly distributed)
    frame_positions = np.linspace(0, total_frames - 1, num_frames, dtype=int)
    print(f"Frame positions to extract: {frame_positions}", file=sys.stderr)
    
    frames = []
    for pos in frame_positions:
        # Set frame position
        cap.set(cv2.CAP_PROP_POS_FRAMES, pos)
        ret, frame = cap.read()
        
        if ret:
            # Convert frame timestamp to HH:MM:SS format
            timestamp = pos / fps
            hours = int(timestamp // 3600)
            minutes = int((timestamp % 3600) // 60)
            seconds = int(timestamp % 60)
            timestamp_str = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
            
            # Convert frame to JPEG and then to base64
            _, buffer = cv2.imencode('.jpg', frame)
            img_base64 = base64.b64encode(buffer).decode('utf-8')
            
            frames.append({
                "timestamp": timestamp_str,
                "image": f"data:image/jpeg;base64,{img_base64}"
            })
            print(f"Extracted frame at position {pos} ({timestamp_str})", file=sys.stderr)
        else:
            print(f"Failed to read frame at position {pos}", file=sys.stderr)
    
    cap.release()
    print(f"Extracted {len(frames)} frames total", file=sys.stderr)
    return frames

def detect_scene_changes(video_path: str, threshold: float = 30.0) -> List[Dict[str, str]]:
    """
    Detect major scene changes in the video and extract frames at those points.
    """
    print(f"Opening video file: {video_path}", file=sys.stderr)
    cap = cv2.VideoCapture(str(video_path))
    
    if not cap.isOpened():
        raise ValueError(f"Failed to open video file: {video_path}")
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    print(f"Video properties: frames={total_frames}, fps={fps}", file=sys.stderr)
    
    prev_frame = None
    frames = []
    frame_count = 0
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
            
        # Convert to grayscale for comparison
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        if prev_frame is not None:
            # Calculate mean absolute difference between frames
            diff = cv2.absdiff(gray, prev_frame)
            mean_diff = np.mean(diff)
            
            # If difference is above threshold, save frame
            if mean_diff > threshold:
                timestamp = frame_count / fps
                hours = int(timestamp // 3600)
                minutes = int((timestamp % 3600) // 60)
                seconds = int(timestamp % 60)
                timestamp_str = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
                
                _, buffer = cv2.imencode('.jpg', frame)
                img_base64 = base64.b64encode(buffer).decode('utf-8')
                
                frames.append({
                    "timestamp": timestamp_str,
                    "image": f"data:image/jpeg;base64,{img_base64}"
                })
                print(f"Detected scene change at frame {frame_count} ({timestamp_str}), diff={mean_diff:.2f}", file=sys.stderr)
        
        prev_frame = gray
        frame_count += 1
        
        if frame_count % 100 == 0:
            print(f"Processed {frame_count}/{total_frames} frames", file=sys.stderr)
    
    cap.release()
    print(f"Detected {len(frames)} scene changes", file=sys.stderr)
    return frames 

def resize_maintaining_aspect_ratio(frame, target_width=None, target_height=None):
    """
    Resize image to target width or height while maintaining aspect ratio.
    If both dimensions are provided, will use the more constraining one.
    """
    original_height, original_width = frame.shape[:2]
    aspect_ratio = original_width / original_height

    if target_width and target_height:
        # Check which dimension is the constraining factor
        if target_width / target_height > aspect_ratio:
            # Height is constraining
            target_width = int(target_height * aspect_ratio)
        else:
            # Width is constraining
            target_height = int(target_width / aspect_ratio)
    elif target_width:
        target_height = int(target_width / aspect_ratio)
    elif target_height:
        target_width = int(target_height * aspect_ratio)
    
    return cv2.resize(frame, (target_width, target_height), interpolation=cv2.INTER_AREA)

def capture_frame_at_timestamp(
    video_path: str,
    timestamp: float,
    description: Optional[str] = None,
    max_width: Optional[int] = None,
    max_height: Optional[int] = None,
    target_size: Optional[Tuple[int, int]] = None
) -> Dict:
    """
    Capture a frame at the specified timestamp and optionally resize it.
    """
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError(f"Failed to open video file: {video_path}")
    
    cap.set(cv2.CAP_PROP_POS_MSEC, timestamp * 1000)
    ret, frame = cap.read()
    
    if not ret:
        raise ValueError(f"Failed to read frame at timestamp {timestamp}")
    
    original_height, original_width = frame.shape[:2]
    
    if target_size:
        # Use target width as the constraint, maintain aspect ratio
        target_width, _ = target_size  # Ignore target height, calculate based on aspect
        frame = resize_maintaining_aspect_ratio(frame, target_width=target_width)
    elif max_width or max_height:
        frame = resize_maintaining_aspect_ratio(frame, 
                                             target_width=max_width,
                                             target_height=max_height)
    
    # Convert to base64
    _, buffer = cv2.imencode('.jpg', frame)
    img_base64 = base64.b64encode(buffer).decode('utf-8')
    
    height, width = frame.shape[:2]
    return {
        "frame_path": f"data:image/jpeg;base64,{img_base64}",
        "width": width,
        "height": height,
        "description": description
    }