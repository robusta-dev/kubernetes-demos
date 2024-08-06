from flask import Flask, request, jsonify
import os
import signal
import threading
import time
from datetime import datetime, timedelta
import logging
from prometheus_flask_instrumentator import Instrumentator
import random
import requests
import datetime
from dateutil.parser import isoparse
from cryptography import x509
from cryptography.hazmat.backends import default_backend

start_time = datetime.datetime.now()

PAGE_CONTENT = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Flask App</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f0f8ff;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            color: #333;
        }
        .container {
            text-align: center;
            background: #fff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        h1 {
            color: #ff6347;
        }
        p {
            font-size: 1.2em;
            margin: 10px 0;
        }
        .btn {
            background-color: #ff6347;
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 5px;
            transition: background-color 0.3s;
        }
        .btn:hover {
            background-color: #e5533d;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Welcome to Flask App</h1>
        <p>Your application is running successfully!</p>
        <p>Explore the features and enjoy your stay.</p>
        <a href="/docs" class="btn">API Documentation</a>
    </div>
</body>
</html>
"""

app = Flask(__name__)
Instrumentator().instrument(app).expose(app)

CONFIG_PATH = '/config/crash_counter.txt'
CERT_PATH = '/certs/certificate.pem'
KEY_PATH = '/certs/key.pem'

def get_certificate_expiration():
    if not os.path.exists(CERT_PATH):
        raise FileNotFoundError(f"Certificate file not found: {CERT_PATH}")

    with open(CERT_PATH, 'rb') as cert_file:
        cert_data = cert_file.read()

    try:
        cert = x509.load_pem_x509_certificate(cert_data, default_backend())
        expiration_date = cert.not_valid_after
        return expiration_date
    except Exception as e:
        raise ValueError(f"Error loading certificate: {e}")


def latency_test_thread():
    while True:
        latency_test()
        sleep_time = random.uniform(0.5, 10.0)  # Random sleep time between 0.5 and 2 seconds
        time.sleep(sleep_time)

def latency_test():
    try:
        url = "http://localhost:5000/"
        response = requests.get(url)
    except requests.exceptions.RequestException as e:
        logging.exception(f"An error occurred: {e}")

class ExpiredCertException(Exception):
    pass

def read_file(file_path):
    try:
        with open(file_path, 'r') as f:
            return f.read().strip()
    except Exception as e:
        return ""

def write_file(file_path, content):
    dir_path = os.path.dirname(file_path)
    if not os.path.exists(dir_path):
        os.makedirs(dir_path)
    with open(file_path, 'w') as f:
        f.write(content)

def check_certificate_expiry():
    time.sleep(2)
    logging.info(f"check_certificate_expiry thread started")
    while True:
        time.sleep(60)
        try:
            cert_expiry_str = read_file(CERT_PATH)
            if not cert_expiry_str:
                raise Exception("Null certificate")
            logging.info(f"Validating cert")

            cert_expiry = get_certificate_expiration()
            if datetime.datetime.now() > cert_expiry:
                logging.warning("Certificate has expired. Update the ssl certificate using the '/update_certificate' API or update the config map.")
                raise ExpiredCertException(f"Certificate expired on {cert_expiry}")
            else:
                logging.debug(f"Cert good until {cert_expiry}")

        except ExpiredCertException:
            logging.exception("SSL certificate expired")
            os._exit(1)
        except:
            logging.exception("check_certificate_expiry failed")


@app.route('/')
def home():
    return PAGE_CONTENT

@app.route('/update_certificate', methods=['POST'])
def update_certificate():
    new_certificate = request.json.get('certificate')
    duration = request.json.get('duration', 1440)  # Default to 1 day (1440 minutes)
    duration = min(max(duration, 1), 10080)  # Ensure duration is between 1 minute and 1 week
    
    write_file(CERT_PATH, new_certificate)
    return jsonify({"message": "Certificate updated successfully"}), 200

if __name__ == '__main__':
    logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
    current_certificate = read_file(CERT_PATH)

    threading.Thread(target=check_certificate_expiry, daemon=True).start()
    threading.Thread(target=latency_test_thread, daemon=True).start()
    app.run(host='0.0.0.0', port=5000)
