import time
import logging
import schedule
from apps.therapy_sessions.tasks import update_session_statuses

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_scheduler():
    # Schedule the task to run every 5 minutes
    schedule.every(5).minutes.do(update_session_statuses)
    
    logger.info("Scheduler started")
    
    while True:
        schedule.run_pending()
        time.sleep(60)  # Check every minute

if __name__ == "__main__":
    run_scheduler()