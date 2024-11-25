import vertexai
from vertexai.generative_models import GenerativeModel, Part
from pathlib import Path
import sys
import json
import argparse

PROJECT_ID = "noted-app-302517"

vertexai.init(project=PROJECT_ID, location="us-central1")

def calculate_cost(prompt_tokens: int, response_tokens: int, model_name: str = "gemini-1.5-flash-002"):
    """Calculate cost based on Gemini 1.5 model pricing"""
    total_tokens = prompt_tokens + response_tokens
    is_low_tier = total_tokens <= 128000
    
    # Pricing differs based on the model
    if model_name == "gemini-1.5-flash-002":
        # Flash model pricing
        input_cost_rate = 0.00001875 if is_low_tier else 0.0000375  # per 1K tokens
        output_cost_rate = 0.000075 if is_low_tier else 0.00015  # per 1K tokens
    elif model_name == "gemini-1.5-pro-002":
        # Pro model pricing
        input_cost_rate = 0.0000375 if is_low_tier else 0.0000750  # per 1K tokens
        output_cost_rate = 0.000150 if is_low_tier else 0.000300  # per 1K tokens
    else:
        raise ValueError(f"Unsupported model: {model_name}")
    
    # Text input cost (prompt tokens)
    input_cost = (prompt_tokens / 1000) * input_cost_rate
    
    # Text output cost (response tokens)
    output_cost = (response_tokens / 1000) * output_cost_rate
    
    # Total cost
    total_cost = input_cost + output_cost
    
    return {
        "model": model_name,
        "input_cost": round(input_cost, 6),
        "output_cost": round(output_cost, 6),
        "total_cost": round(total_cost, 6)
    }

def process_video(video_path: str, prompt_path: str, mode: str = "transcribe", pdf_path: str = None, model_name: str = "gemini-1.5-flash-002"):
    # Initialize the model based on the selected model name
    model = GenerativeModel(model_name)

    # If PDF is provided, use the context-aware prompt from the frontend/public/prompts directory
    if pdf_path:
        # Get the directory of the original prompt
        prompt_dir = Path(prompt_path).parent
        context_prompt_path = prompt_dir / 'procedure_from_video_prompt_with_additional_context.txt'
        print(f"Using context-aware prompt: {context_prompt_path}", file=sys.stderr)
        prompt_path = str(context_prompt_path)

    # Validate prompt file
    prompt_path = Path(prompt_path)
    if not prompt_path.exists():
        raise FileNotFoundError(f"Prompt file not found at {prompt_path}")

    with open(prompt_path, "r") as f:
        prompt = f.read().strip()
        if not prompt:
            raise ValueError("Prompt file is empty")

    # Validate video file
    video_file_path = Path(video_path)
    if not video_file_path.exists():
        raise FileNotFoundError(f"Video file not found at {video_file_path}")

    contents = []
    
    # Add video file
    with open(video_file_path, "rb") as f:
        video_file = Part.from_data(data=f.read(), mime_type="video/mp4")
        contents.append(video_file)
        print("Added video file to contents", file=sys.stderr)

    # Add PDF file if provided
    if pdf_path:
        pdf_file_path = Path(pdf_path)
        if not pdf_file_path.exists():
            raise FileNotFoundError(f"PDF file not found at {pdf_path}")
            
        with open(pdf_file_path, "rb") as f:
            pdf_file = Part.from_data(data=f.read(), mime_type="application/pdf")
            print("Added PDF file to contents", file=sys.stderr)
            contents.append(pdf_file)

    # Add prompt
    contents.append(Part.from_text(prompt))
    print("Added prompt to contents", file=sys.stderr)
    print(f"Total number of content parts: {len(contents)}", file=sys.stderr)

    # Get token count for input
    token_count = model.count_tokens(contents)
    prompt_tokens = token_count.total_tokens
    print(f"Input token count: {prompt_tokens}", file=sys.stderr)

    # Generate response
    response = model.generate_content(contents)
    print("Received response from model", file=sys.stderr)
    
    # Get token count for response
    response_tokens = model.count_tokens([Part.from_text(response.text)]).total_tokens
    print(f"Response token count: {response_tokens}", file=sys.stderr)
    
    # Calculate costs
    costs = calculate_cost(prompt_tokens, response_tokens, model_name)
    
    token_usage = {
        "prompt_tokens": prompt_tokens,
        "response_tokens": response_tokens,
        "total_tokens": prompt_tokens + response_tokens,
        "costs": costs
    }
    
    if mode == "procedure":
        # Parse the response into a structured format
        try:
            # Extract sections from the response
            text = response.text
            sections = {}
            
            # Find the title
            title_start = text.find("TITLE:") + 6
            overview_start = text.find("OVERVIEW:")
            sections["title"] = text[title_start:overview_start].strip()
            
            # Find the overview
            prerequisites_start = text.find("PREREQUISITES:")
            sections["overview"] = text[overview_start + 9:prerequisites_start].strip()
            
            # Find prerequisites
            procedure_start = text.find("PROCEDURE:")
            prereq_text = text[prerequisites_start + 14:procedure_start]
            sections["prerequisites"] = [p.strip()[2:] for p in prereq_text.split("\n") if p.strip().startswith("-")]
            
            # Find steps
            verification_start = text.find("VERIFICATION:")
            procedure_text = text[procedure_start + 10:verification_start]
            
            # Parse steps
            steps = []
            current_step = None
            
            for line in procedure_text.split("\n"):
                line = line.strip()
                if not line:
                    continue
                    
                if line[0].isdigit() and "." in line:
                    if current_step:
                        steps.append(current_step)
                    current_step = {
                        "main": line[line.find(".")+1:].strip(),
                        "sub": [],
                        "warnings": [],
                        "tips": []
                    }
                elif line.startswith("a.") or line.startswith("b.") or line.startswith("c."):
                    if current_step:
                        current_step["sub"].append(line[2:].strip())
                elif line.startswith("⚠️"):
                    if current_step:
                        current_step["warnings"].append(line[2:].strip())
                elif line.startswith("💡"):
                    if current_step:
                        current_step["tips"].append(line[2:].strip())
                        
            if current_step:
                steps.append(current_step)
                
            sections["steps"] = steps
            
            # Find verification
            troubleshooting_start = text.find("TROUBLESHOOTING:")
            sections["verification"] = text[verification_start + 13:troubleshooting_start].strip()
            
            # Find troubleshooting
            troubleshooting_text = text[troubleshooting_start + 16:].strip()
            sections["troubleshooting"] = [t.strip()[2:] for t in troubleshooting_text.split("\n") if t.strip().startswith("-")]
            
            # Add token usage to the response
            sections["token_usage"] = token_usage
            
            return json.dumps(sections)
        except Exception as e:
            raise ValueError(f"Failed to parse procedure: {str(e)}")
    else:
        # For transcribe mode, return both text and token usage
        return json.dumps({
            "text": response.text,
            "token_usage": token_usage
        })

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process video for transcription or procedure generation")
    parser.add_argument("video_path", help="Path to the video file")
    parser.add_argument("prompt_path", help="Path to the prompt file")
    parser.add_argument("--mode", choices=["transcribe", "procedure"], default="transcribe",
                      help="Processing mode: transcribe or procedure")
    parser.add_argument("--pdf", help="Path to an optional PDF file for additional context")
    parser.add_argument("--model", choices=["gemini-1.5-flash-002", "gemini-1.5-pro-002"], 
                      default="gemini-1.5-flash-002", help="Gemini model to use")
    
    args = parser.parse_args()
    
    try:
        result = process_video(args.video_path, args.prompt_path, args.mode, args.pdf, args.model)
        print(result)
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)
