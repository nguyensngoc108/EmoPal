#!/bin/bash
echo "Starting development environment..."

# Start Daphne for WebSockets on port 8001
echo "Starting Daphne on port 8001 for WebSockets..."
daphne -b 0.0.0.0 -p 8001 server.asgi:application &
DAPHNE_PID=$!

# Start Django development server with Stripe on port 8000
echo "Starting Django with Stripe on port 8000..."
python manage.py runserver_with_stripe 0.0.0.0:8000

# When Django server stops, kill Daphne
kill $DAPHNE_PID
