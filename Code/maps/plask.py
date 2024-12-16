from flask import Flask, render_template, jsonify
import requests

app = Flask(__name__, template_folder='../frontend')

API_KEY = "4f040348a11373f7f6d1cdae6778fd0f"

@app.route("/")
def index():
    return render_template("test.html")

@app.route("/places")
def get_places():
    # 카카오 REST API 호출
    url = "https://dapi.kakao.com/v2/local/search/keyword.json"
    params = {
        "query": "스타벅스",
        "x": "126.9784147",
        "y": "37.5666805",
        "radius": 2000,
    }
    headers = {"Authorization": f"KakaoAK {API_KEY}"}
    response = requests.get(url, headers=headers, params=params)

    if response.status_code == 200:
        return jsonify(response.json())
    else:
        return jsonify({"error": response.text}), response.status_code

if __name__ == "__main__":
    app.run(debug=True)
