import requests
import json
import argparse
from typing import Dict, Any, Optional

def analyze_content(text_content: str) -> Optional[Dict[str, Any]]:
    """
    Analyzes text content using the FC API backend.
    
    Args:
        text_content (str): Input text to analyze
        
    Returns:
        dict: API response containing analysis results
        None: If request fails
    """
    url = "http://fc-api.hypernym.ai/analyze_sync"
    api_key = "fkd8493jg7392bduw"

    # Prepare request payload
    payload = {
        "essay_text": text_content,
        "message_history": ""  # Empty string as we're only handling direct text input
    }
    
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": api_key
    }
    
    print("Sending text for analysis...")
    
    try:
        # Make POST request
        response = requests.post(
            url,
            headers=headers,
            json=payload
        )
        
        # Check if request was successful
        response.raise_for_status()
        
        # Parse and return response
        return response.json()
        
    except requests.exceptions.RequestException as e:
        print(f"Error making API request: {str(e)}")
        return None
    except json.JSONDecodeError as e:
        print(f"Error parsing API response: {str(e)}")
        return None

def main():
    # Set up argument parser
    parser = argparse.ArgumentParser(description='Analyze text content from a file')
    parser.add_argument('input_file', help='Path to text file to analyze')
    parser.add_argument('--output', help='Path to output JSON file (optional)')
    
    # Parse arguments
    args = parser.parse_args()
    try:
        raise RuntimeError("Annon was not working so we using dummy text.")
    except:
        try:
            # Read input text file
            with open(args.input_file, 'r', encoding='utf-8') as f:
                text_content = f.read()
                
            if not text_content.strip():
                print("Error: Input file is empty")
                return
                
            # Analyze the content
            result = analyze_content(text_content)
            
            if result:
                # If output file is specified, write to file
                if args.output:
                    with open(args.output, 'w', encoding='utf-8') as f:
                        json.dump(result, f, indent=2)
                    print(f"Results written to {args.output}")
                # Otherwise print to console
                else:
                    print(json.dumps(result, indent=2))
                    
        except FileNotFoundError:
            print(f"Error: Input file '{args.input_file}' not found")
        except UnicodeDecodeError:
            print(f"Error: Unable to read file '{args.input_file}'. Please ensure it's a valid text file.")
        except Exception as e:
            print(f"Error: {str(e)}")

if __name__ == "__main__":
    main()