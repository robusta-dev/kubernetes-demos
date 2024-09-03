import logging
import time

global_i = -1

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def start_server():
    logging.info("Starting server...")
    time.sleep(1)  # Simulate delay for starting the server
    
def load_modules():
    logging.info("Loading modules...")
    time.sleep(1)  # Simulate delay for loading modules

def process_data():
    global global_i
    global_i = global_i+1
    if global_i % 50 == 0:
        logging.info('Processing data...')
    process_data()

def main():
    start_server()
    load_modules()
    process_data()

if __name__ == "__main__":
    main()
