#!/bin/bash

# Navigate to the script's directory
echo "Cleanup started."
# Find and remove node_modules directories, dist directories.
find . -type d -name "node_modules" -exec rm -rf {} + \
    -o -type d -name "dist" -exec rm -rf {} + \
    -o -path "./build/artifacts/*" -exec rm -rf {} + \
    -o -path "./build/cache/*" -exec rm -rf {} +

echo "Cleanup completed."
