from flask import Flask, request, jsonify
import logging

logging.basicConfig(level=logging.INFO)

config = {"host": "0.0.0.0"}  # Fixed: Restore config dict instead of None
host = config["host"]

app = Flask(__name__)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy"}), 200

if __name__ == '__main__':
    app.run(host=host, port=5000)
