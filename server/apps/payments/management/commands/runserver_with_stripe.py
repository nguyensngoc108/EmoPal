import os
import subprocess
import threading
import time
from django.core.management.base import BaseCommand
from django.core.management import call_command

class Command(BaseCommand):
    help = 'Runs Django server with Stripe webhook listening'

    def handle(self, *args, **options):
        # Start Stripe CLI in a separate thread
        stripe_thread = threading.Thread(target=self._run_stripe_cli)
        stripe_thread.daemon = True
        stripe_thread.start()
        
        # Wait for Stripe CLI to initialize
        time.sleep(2)
        self.stdout.write(self.style.SUCCESS('Stripe webhook forwarding started'))
        
        # Run Django server in the main thread
        self.stdout.write(self.style.SUCCESS('Starting Django server...'))
        call_command('runserver', *args, **options)
    
    def _run_stripe_cli(self):
        try:
            # Execute the Stripe CLI command
            subprocess.run(
                ['stripe', 'listen', '--forward-to', 'localhost:8000/api/payments/webhook/'],
                check=True
            )
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Error starting Stripe CLI: {e}'))