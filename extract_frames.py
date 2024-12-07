import argparse
import json
import sys
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from video_utils import extract_key_frames, detect_scene_changes, capture_frame_at_timestamp

@dataclass
class TimestampMark:
    timestamp: float  # in seconds
    description: Optional[str]
    frame_path: Optional[str]
    target_size: Optional[Tuple[int, int]] = None  # (width, height)

def capture_marked_timestamps(
    video_path: str, 
    timestamps: List[TimestampMark],
    max_width: Optional[int] = None,
    max_height: Optional[int] = None
) -> List[Dict]:
    """
    Capture frames at specific timestamps and return frame information.
    Optionally resize images to fit within max dimensions while preserving aspect ratio.
    """
    captured_frames = []
    for mark in timestamps:
        frame_data = capture_frame_at_timestamp(
            video_path, 
            mark.timestamp,
            description=mark.description,
            max_width=max_width,
            max_height=max_height
        )
        mark.frame_path = frame_data['frame_path']
        captured_frames.append({
            'timestamp': mark.timestamp,
            'frame_path': frame_data['frame_path'],
            'description': mark.description,
            'width': frame_data['width'],
            'height': frame_data['height']
        })
    return captured_frames

def main():
    parser = argparse.ArgumentParser(description="Extract frames from video")
    parser.add_argument("video_path", help="Path to the video file")
    parser.add_argument("--mode", 
                       choices=["keyframes", "scenes", "timestamps"], 
                       default="keyframes",
                       help="Frame extraction mode: keyframes, scenes, or timestamps")
    parser.add_argument("--num-frames", type=int, default=5,
                      help="Number of frames to extract in keyframes mode")
    parser.add_argument("--threshold", type=float, default=30.0,
                      help="Threshold for scene change detection")
    parser.add_argument("--timestamps", type=str,
                      help="JSON file containing timestamp marks (for timestamps mode)")
    parser.add_argument("--max-width", type=int,
                      help="Maximum width for captured frames")
    parser.add_argument("--max-height", type=int,
                      help="Maximum height for captured frames")
    
    args = parser.parse_args()
    
    try:
        print(f"Processing video: {args.video_path}", file=sys.stderr)
        print(f"Mode: {args.mode}", file=sys.stderr)

        frames = []
        if args.mode == "keyframes":
            print(f"Num frames: {args.num_frames}", file=sys.stderr)
            frames = extract_key_frames(
                args.video_path, 
                args.num_frames,
                max_width=args.max_width,
                max_height=args.max_height
            )
            print(f"Extracted {len(frames)} key frames", file=sys.stderr)
        
        elif args.mode == "scenes":
            print(f"Threshold: {args.threshold}", file=sys.stderr)
            frames = detect_scene_changes(
                args.video_path, 
                args.threshold,
                max_width=args.max_width,
                max_height=args.max_height
            )
            print(f"Detected {len(frames)} scene changes", file=sys.stderr)
        
        elif args.mode == "timestamps":
            if not args.timestamps:
                raise ValueError("Timestamps file must be provided in timestamps mode")
            
            with open(args.timestamps) as f:
                timestamp_data = json.load(f)
            
            timestamp_marks = [
                TimestampMark(
                    timestamp=mark['timestamp'],
                    description=mark.get('description'),
                    frame_path=None
                ) for mark in timestamp_data
            ]
            
            frames = capture_marked_timestamps(
                args.video_path, 
                timestamp_marks,
                max_width=args.max_width,
                max_height=args.max_height
            )
            print(f"Captured {len(frames)} frames at marked timestamps", file=sys.stderr)
        
        if not frames:
            print("Warning: No frames were extracted", file=sys.stderr)
            frames = []
        
        print(json.dumps(frames))
    
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        import traceback
        print(traceback.format_exc(), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main() 