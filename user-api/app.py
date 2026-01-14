from flask import Flask, jsonify

app = Flask(__name__)

config = {"host": "0.0.0.0", "port": 5000}

host = config["host"]
port = config["port"]


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host=host, port=port)
