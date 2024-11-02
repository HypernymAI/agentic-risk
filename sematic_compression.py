# semantic_compression.py
import requests
import json
import argparse
from typing import Dict, Any, Optional

def analyze_content(input_json: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Analyzes both terms of service and message history using the FC API backend.
    
    Args:
        input_json (dict): Input JSON containing termsOfService and messageHistory fields
    
    Returns:
        dict: API response containing analysis results
        None: If request fails or required fields are missing
    """
    url = "http://fc-api.hypernym.ai/analyze_sync"
    api_key = "fkd8493jg7392bduw"
    
    # Check for required fields
    if 'termsOfService' not in input_json:
        print("Error: termsOfService field not found in input JSON")
        return None
        
    # Prepare request payload
    payload = {
        "essay_text": input_json["termsOfService"]["plainText"],
        "message_history": input_json.get("messageHistory", "")  # Use empty string if no messages
    }
    
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": api_key
    }
    print(payload)
    
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
    parser = argparse.ArgumentParser(description='Analyze terms of service and message history from JSON file')
    parser.add_argument('input_file', help='Path to combined JSON file from firstPage.js')
    parser.add_argument('--output', help='Path to output JSON file (optional)')
    
    # Parse arguments
    args = parser.parse_args()
    
    try:
        # Read input JSON file
        with open(args.input_file, 'r') as f:
            input_json = json.load(f)
            
        # Analyze the content
        result = analyze_content(input_json)
        
        if result:
            # If output file is specified, write to file
            if args.output:
                with open(args.output, 'w') as f:
                    json.dump(result, f, indent=2)
                print(f"Results written to {args.output}")
            # Otherwise print to console
            else:
                print(json.dumps(result, indent=2))
                
    except FileNotFoundError:
        print(f"Error: Input file '{args.input_file}' not found")
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON in input file '{args.input_file}'")
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    main()