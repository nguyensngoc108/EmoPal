#!/bin/bash
# filepath: /Users/hephaestus/AI_Face_Present/deploy.sh

# Color codes for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}=========================================="
echo "   AI Face Present - Public Deployment"
echo -e "===========================================${NC}"

# Check MongoDB connection using your existing URI
echo -e "${CYAN}Checking MongoDB connection...${NC}"
python3 -c "
from pymongo import MongoClient
import sys
try:
    # Using your actual MongoDB connection string
    client = MongoClient('mongodb+srv://nguyensngoc12:65smbABwDralpSmf@individualserver.byohaww.mongodb.net/', serverSelectionTimeoutMS=5000)
    # Force a connection to verify
    client.admin.command('ping')
    print('MongoDB connection successful!')
    db_names = client.list_database_names()
    print(f'Available databases: {db_names}')
    sys.exit(0)
except Exception as e:
    print(f'Error connecting to MongoDB: {str(e)}')
    sys.exit(1)
"

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to connect to MongoDB.${NC}"
    echo -e "${YELLOW}This may cause login/authentication issues.${NC}"
    read -p "Continue deployment anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Deployment aborted.${NC}"
        exit 1
    fi
fi

# Install dependencies if needed
echo -e "${CYAN}Installing required Python packages...${NC}"
pip install dnspython pymongo channels django-cors-headers

# Build the React client app
echo -e "${CYAN}Building React client application...${NC}"
cd /Users/hephaestus/AI_Face_Present/client

# Build the React app
echo "Building production bundle..."
npm run build

# Create necessary directories in Django
echo -e "${CYAN}Setting up Django directories...${NC}"
mkdir -p /Users/hephaestus/AI_Face_Present/server/staticfiles
mkdir -p /Users/hephaestus/AI_Face_Present/server/templates

# Copy React build files to Django
echo "Copying React build files to Django..."
cp -r build/static/* /Users/hephaestus/AI_Face_Present/server/staticfiles/

# CRITICAL: Copy index.html to the templates directory
echo "Setting up template..."
cp build/index.html /Users/hephaestus/AI_Face_Present/server/templates/

# Copy other assets (favicon, manifest, etc.)
echo "Copying other assets..."
cp -r build/* /Users/hephaestus/AI_Face_Present/server/staticfiles/ 2>/dev/null || true

# Collect Django static files
echo -e "${CYAN}Collecting Django static files...${NC}"
cd /Users/hephaestus/AI_Face_Present/server
python manage.py collectstatic --noinput --clear

# Ensure settings.py is using the correct MongoDB URI
SETTINGS_FILE="/Users/hephaestus/AI_Face_Present/server/server/settings.py"
echo "Updating MongoDB connection in settings..."
sed -i '' "s|MONGO_URI = os.environ.get('MONGO_URI', '.*')|MONGO_URI = os.environ.get('MONGO_URI', 'mongodb+srv://nguyensngoc12:65smbABwDralpSmf@individualserver.byohaww.mongodb.net/')|" "$SETTINGS_FILE" || echo "Could not update settings.py - please check the MongoDB connection string manually."

# Start Django server
echo -e "${GREEN}Starting Django server...${NC}"
python manage.py runserver 0.0.0.0:8000 &
SERVER_PID=$!

# Give Django a moment to start up
echo "Waiting for Django to initialize..."
sleep 3

# Verify Django is running
if ! ps -p $SERVER_PID > /dev/null; then
    echo -e "${RED}Django server failed to start. Check for errors above.${NC}"
    exit 1
fi

echo -e "${GREEN}Django server running with PID: $SERVER_PID${NC}"

# Display important information
echo -e "${CYAN}===========================================${NC}"
echo -e "${GREEN}Deployment Information:${NC}"
echo -e "  Local Server: http://localhost:8000/"
echo -e "  Starting ngrok for public access..."
echo -e "${YELLOW}When ngrok displays the URL, share it with your testers.${NC}"
echo -e "${CYAN}===========================================${NC}"

# Define cleanup function for graceful exit
cleanup() {
    echo -e "\n${CYAN}Stopping services...${NC}"
    
    # Stop Django server
    if ps -p $SERVER_PID > /dev/null; then
        echo "Stopping Django server (PID: $SERVER_PID)..."
        kill $SERVER_PID
    fi
    
    echo -e "${GREEN}Deployment terminated.${NC}"
    exit 0
}

# Set up trap to catch Ctrl+C and other termination signals
trap cleanup SIGINT SIGTERM EXIT

# Start ngrok - no subdomain for free tier
ngrok http 8000

# Note: The cleanup function will be called automatically when the script exits
