from flask import Flask

app = Flask(__name__)

config = {"host": "0.0.0.0", "port": 5000}

host = config["host"]
port = config["port"]

@app.route('/health')
def health():
    return 'OK', 200

@app.route('/api/create_user', methods=['POST'])
def create_user():
    return {'status': 'user created'}, 201

if __name__ == '__main__':
    app.run(host=host, port=port)
