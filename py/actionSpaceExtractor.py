import requests
import re
import json
import argparse
import sys
from typing import Dict, List, Set
from urllib.parse import urlparse

class TypeScriptExportExtractor:
    def __init__(self, base_url: str = "https://github.com/anon-dot-com/actions/blob/main/src/app"):
        self.base_url = base_url.rstrip('/')
        
        # Patterns for different types of declarations
        self.patterns = {
            'exported_const': r'export\s+const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=',
            'async_function': [
                # Regular async function declarations
                r'async\s+function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(',
                # Async arrow functions assigned to variables
                r'const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*async\s*\(',
                # Exported async functions
                r'export\s+async\s+function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(',
                # Exported const async arrow functions
                r'export\s+const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*async\s*\(',
                # Class methods that are async
                r'async\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(',
            ]
        }

    def _build_url(self, provider: str) -> str:
        """Build the complete URL from base URL and provider name."""
        return f"{self.base_url}/{provider}.ts"

    def _convert_to_raw_url(self, github_url: str) -> str:
        """Convert a GitHub URL to its raw content URL."""
        parsed = urlparse(github_url)
        if 'github.com' not in parsed.netloc:
            raise ValueError("Not a GitHub URL")
        
        path_parts = parsed.path.split('/')
        if 'blob' in path_parts:
            path_parts.remove('blob')
            
        raw_url = f"https://raw.githubusercontent.com{'/'.join(path_parts)}"
        return raw_url

    def _remove_comments(self, code: str) -> str:
        """Remove single-line and multi-line comments from the code."""
        # Remove multi-line comments
        code = re.sub(r'/\*[\s\S]*?\*/', '', code)
        # Remove single-line comments
        code = re.sub(r'//.*$', '', code, flags=re.MULTILINE)
        return code

    def _extract_matches(self, content: str, patterns: List[str]) -> Set[str]:
        """Extract all matches for given patterns from content."""
        matches = set()
        for pattern in patterns if isinstance(patterns, list) else [patterns]:
            found = re.finditer(pattern, content, re.MULTILINE)
            matches.update(match.group(1) for match in found)
        return matches

    def extract_functions(self, provider: str) -> Dict[str, List[str]]:
        """
        Extract all exported constants and async functions from a TypeScript file.
        
        Args:
            provider (str): Name of the provider (without .ts extension)
            
        Returns:
            Dict[str, List[str]]: Dictionary with "actionSpace" key containing list of function names
        """
        try:
            # Build the complete URL
            github_url = self._build_url(provider)
            
            # Convert to raw URL and fetch content
            raw_url = self._convert_to_raw_url(github_url)
            response = requests.get(raw_url)
            response.raise_for_status()
            content = response.text

            # Remove comments to avoid false positives
            content = self._remove_comments(content)

            # Extract all functions using patterns
            all_functions = set()
            
            # Get exported constants
            exported_consts = self._extract_matches(content, self.patterns['exported_const'])
            all_functions.update(exported_consts)
            
            # Get async functions
            async_functions = self._extract_matches(content, self.patterns['async_function'])
            all_functions.update(async_functions)

            # Convert to sorted list for consistent output
            sorted_functions = sorted(list(all_functions))

            return {"actionSpace": sorted_functions}

        except requests.exceptions.RequestException as e:
            raise Exception(f"Error fetching TypeScript file for provider {provider}: {str(e)}")
        except Exception as e:
            raise Exception(f"Error processing TypeScript file for provider {provider}: {str(e)}")

def main():
    """Main function to handle command line arguments and execute the extractor."""
    parser = argparse.ArgumentParser(
        description='Extract exported constants and async functions from a TypeScript provider file.'
    )
    parser.add_argument(
        'provider',
        type=str,
        help='Name of the provider (without .ts extension)'
    )
    parser.add_argument(
        '--base-url',
        type=str,
        default="https://github.com/anon-dot-com/actions/blob/main/src/app",
        help='Base URL for the GitHub repository (default: %(default)s)'
    )

    args = parser.parse_args()

    try:
        extractor = TypeScriptExportExtractor(args.base_url)
        result = extractor.extract_functions(args.provider)
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()