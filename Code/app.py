from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from maps.FindDestination import calculate_centroid, find_optimal_station, get_nearby_subway_stations, haversine
import pandas as pd
import os
import json
import requests  # Add this import
from openai import AzureOpenAI
app = Flask(__name__, template_folder="templates", static_folder="templates")

search_endpoint = "https://team6service.search.windows.net"
search_key = "6SpnKI68OU13s1mCRvfL2XaKNqEwIJjgAzmvbLmrB9AzSeCaYcUP"
client = AzureOpenAI(
    azure_endpoint=("https://recomo-openai.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2024-08-01-preview"),
    api_key=("2kt0epiqWh6zIwteoaMjEuto3624Q0LP1IBgEGKeSIKW2QOeNBKLJQQJ99ALACHYHv6XJ3w3AAABACOG9aZt"),
    api_version="2024-02-01"
)

# API 키 설정
KAKAO_API_KEY = "4f040348a11373f7f6d1cdae6778fd0f"
KAKAO_JAVASCRIPT_KEY = "0dff67bd8267e5a437996508dae7e7d8"
ODSAY_API_KEY = "6NGvqhV5Q5n77duoHpFxDfQzFsSoi77quyRJDe9yvl0"

# 데이터베이스 설정
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///preferences.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

# DB 모델
class Preference(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(4), nullable=False)  # 비밀번호 필드 추가
    location = db.Column(db.String(120), nullable=False)
    latitude = db.Column(db.Float, nullable=False)  # 위도 필드 추가
    longitude = db.Column(db.Float, nullable=False)  # 경도 필드 추가
    positive_prompt = db.Column(db.Text, nullable=True)
    negative_prompt = db.Column(db.Text, nullable=True)

class Moim(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    meeting_name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=False)
    date = db.Column(db.String(50), nullable=False)
    time = db.Column(db.String(50), nullable=False)
    friends = db.Column(db.Text, nullable=False)
    friend_details = db.Column(db.Text, nullable=False)

# 애플리케이션 시작 시 DB 생성
with app.app_context():
    db.create_all()

@app.route("/")
def home():
    return render_template("HomePage.html")

@app.route("/create-preferences")
def create_preferences():
    return render_template("CreatePreferences.html")

# 취향 데이터 저장 및 DB 내용 출력
@app.route("/save-preference", methods=["POST"])
def save_preference():
    data = request.json
    name = data.get("name")
    location = data.get("location")
    latitude = data.get("latitude")  # 위도 데이터 받기
    longitude = data.get("longitude")  # 경도 데이터 받기
    positive_prompt = data.get("positivePrompt")
    negative_prompt = data.get("negativePrompt")

    # 필수 필드 검증
    if not all([name, location, latitude, longitude]):
        return jsonify({
            "status": "error",
            "message": "필수 정보가 누락되었습니다."
        }), 400

    try:
        # 중복 이름 확인 및 업데이트
        existing_record = Preference.query.filter_by(name=name).first()
        if existing_record:
            existing_record.location = location
            existing_record.latitude = latitude
            existing_record.longitude = longitude
            existing_record.positive_prompt = positive_prompt
            existing_record.negative_prompt = negative_prompt
            message = "정보가 변경되었습니다."
        else:
            # 새로운 데이터 저장
            new_pref = Preference(
                name=name,
                location=location,
                latitude=latitude,
                longitude=longitude,
                positive_prompt=positive_prompt,
                negative_prompt=negative_prompt,
            )
            db.session.add(new_pref)
            message = "데이터가 저장되었습니다."

        db.session.commit()

        # DB 테이블 내용 출력 (디버깅용)
        print("\n현재 저장된 Preferences 테이블:")
        preferences = Preference.query.all()
        for pref in preferences:
            print(f"ID: {pref.id}, 이름: {pref.name}, 위치: {pref.location}, "
                  f"위도: {pref.latitude}, 경도: {pref.longitude}, "
                  f"선호 기준: {pref.positive_prompt}, 제외 조건: {pref.negative_prompt}")
        print("-" * 50)

        return jsonify({"status": "success", "message": message}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error saving preference: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "서버 오류가 발생했습니다."
        }), 500

@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(app.static_folder, filename)

@app.route("/get-friends-names", methods=["GET"])
def get_friend_names():
    try:
        friends = Preference.query.with_entities(Preference.name).all()
        friend_names = [friend.name for friend in friends]
        return jsonify({"names": friend_names})
    except Exception as e:
        print("Error:", e)
        return jsonify({"error": "친구 이름을 불러오는 중 오류가 발생했습니다."}), 500

@app.route("/get-meetings", methods=["GET"])
def get_meetings():
    try:
        meetings = Moim.query.all()
        result = [
            {
                "id": meeting.id,
                "name": meeting.meeting_name,
                "description": meeting.description,
                "date": meeting.date,
                "time": meeting.time,
                "friends": json.loads(meeting.friends),
            }
            for meeting in meetings
        ]
        return jsonify(result)
    except Exception as e:
        print("모임 데이터 불러오기 실패:", e)
        return jsonify({"error": "모임 데이터를 가져오는 중 오류가 발생했습니다."}), 500

@app.route("/create-meeting", methods=["POST"])
def create_meeting():
    try:
        data = request.json
        meeting_name = data.get("name")
        description = data["description"]
        date = data.get("date")
        time = data.get("time")
        selected_friends = data.get("friends", [])

        if not meeting_name or not date or not time:
            return jsonify({"status": "error", "message": "모임 이름, 날짜, 시간은 필수입니다."}), 400

        if not selected_friends:
            return jsonify({"status": "error", "message": "친구를 선택해주세요."}), 400

        existing_meeting = Moim.query.filter_by(meeting_name=meeting_name, date=date, time=time).first()
        if existing_meeting:
            return jsonify({"status": "duplicate", "message": "이미 같은 이름과 시간의 모임이 존재합니다."}), 200

        friends = Preference.query.filter(Preference.name.in_(selected_friends)).all()
        if not friends:
            return jsonify({"status": "error", "message": "선택된 친구의 정보가 없습니다."}), 404

        friend_details = {
            "location": [friend.location for friend in friends if friend.location],
            "coordinates": [{"latitude": friend.latitude, "longitude": friend.longitude} 
                          for friend in friends],  # 좌표 정보 추가
            "positive_prompt": [friend.positive_prompt for friend in friends if friend.positive_prompt],
            "negative_prompt": [friend.negative_prompt for friend in friends if friend.negative_prompt],
        }

        new_moin = Moim(
            meeting_name=meeting_name,
            description=description,
            date=date,
            time=time,
            friends=json.dumps(selected_friends),
            friend_details=json.dumps(friend_details)
        )
        db.session.add(new_moin)
        db.session.commit()

        return jsonify({"status": "success", "message": "모임이 성공적으로 생성되었습니다."})
    except Exception as e:
        print("모임 저장 실패:", e)
        db.session.rollback()
        return jsonify({"status": "error", "message": "서버 오류가 발생했습니다."}), 500


@app.route("/delete-meeting/<int:meeting_id>", methods=["DELETE"])
def delete_meeting(meeting_id):
    """모임 삭제 라우트"""
    try:
        meeting = Moim.query.get(meeting_id)
        if not meeting:
            return jsonify({"status": "error", "message": "모임을 찾을 수 없습니다."}), 404

        db.session.delete(meeting)
        db.session.commit()
        return jsonify({"status": "success", "message": "모임이 성공적으로 삭제되었습니다."})
    except Exception as e:
        print("모임 삭제 실패:", e)
        db.session.rollback()
        return jsonify({"status": "error", "message": "서버 오류가 발생했습니다."}), 500
    
@app.route("/recommend")
def recommend_page():
    meeting_name = request.args.get("meeting_name", "")
    return render_template("Recommend.html", meeting_name=meeting_name, JAVASCRIPT_KEY=KAKAO_JAVASCRIPT_KEY)

@app.route("/centroid")
def get_centroid():
    try:
        # CSV 파일 읽기
        data = pd.read_csv('../../Data/maps/subway_stations.csv')

        centroid = calculate_centroid([(37.4842, 126.9293), (37.513768, 127.100080)])

        # '위도'와 '경도'가 숫자 형식인지 확인하고, 결측값 처리
        data['위도'] = pd.to_numeric(data['위도'], errors='coerce')
        data['경도'] = pd.to_numeric(data['경도'], errors='coerce')
        data = data.fillna({'위도': 0, '경도': 0})

        # 각 전철역과 현재 위치 사이의 거리 계산
        data['거리'] = data.apply(lambda row: haversine(centroid[0], centroid[1], row['위도'], row['경도']), axis=1)

        # 가장 가까운 역 찾기
        nearest_station = data.loc[data['거리'].idxmin()]
        result = jsonify({
            "station": nearest_station['역사명']+"역",
            "latitude": nearest_station['위도'],
            "longitude": nearest_station['경도']
        })
        return result
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/places")
def get_places():
    try:
        latitude = 37.4842
        longitude = 126.9293

        # 카카오 API 호출
        url = "https://dapi.kakao.com/v2/local/search/keyword.json"
        params = {
            "query": "음식점",
            "x": str(longitude),
            "y": str(latitude),
            "radius": 5000,
        }
        headers = {"Authorization": f"KakaoAK {KAKAO_API_KEY}"}
        response = requests.get(url, headers=headers, params=params)

        if response.status_code == 200:
            result = response.json()
            result['centroid'] = {"latitude": latitude, "longitude": longitude}
            return jsonify(result)
        else:
            print(f"Kakao API error: {response.text}")  # Changed logging to print
            return jsonify({"error": response.text}), response.status_code
    except Exception as e:
        print(f"Error in get_places: {str(e)}")  # Changed logging to print
        return jsonify({"error": str(e)}), 500
    
@app.route('/optimal-station', methods=['POST'])
def optimal_station():
    try:
        # 요청 데이터 처리
        data = request.json
        origins = data.get('origins', [])
        radius_m = data.get('radius', 5000)

        centroid = calculate_centroid(origins)  
        subway_stations = get_nearby_subway_stations(centroid, radius_m)

        if not subway_stations:
            return jsonify({"error": "No subway stations found within the radius"}), 404

        result = find_optimal_station(origins, subway_stations)
    
        return jsonify({
            "centroid": {"latitude": centroid['latitude'], "longitude": centroid['longitude']},
            "optimal_station_by_total": result["optimal_station_by_total"],
            "details": result["details"],
        })
    except Exception as e:
        # 에러 메시지를 터미널에 출력
        print("Error occurred:", str(e))

        # Flask 로거에 에러 메시지 추가
        app.logger.error(f"Error occurred: {str(e)}")

        return jsonify({"error": str(e)}), 500


from urllib.parse import unquote

@app.route("/get-meeting-details/<path:meeting_name>", methods=["GET"])
def get_meeting_details(meeting_name):
    """모임 이름으로 모임 데이터를 가져오는 API"""
    try:
        decoded_name = unquote(meeting_name)  # URL 디코딩 처리
        meeting = Moim.query.filter_by(meeting_name=decoded_name).first()
        friends =json.loads(meeting.friends)
        friend_details = json.loads(meeting.friend_details)

        coordinates = friend_details.get("coordinates", [])        
        centroid = calculate_centroid(coordinates)  
        subway_stations = get_nearby_subway_stations(centroid)

        if not subway_stations:
            return jsonify({"error": "No subway stations found within the radius"}), 404

        result = find_optimal_station(coordinates, subway_stations)
        print(result)

        if not meeting:
            return jsonify({"error": "모임 정보를 찾을 수 없습니다."}), 404
        return jsonify({
            "name": meeting.meeting_name,
            "description": meeting.description,
            "date": meeting.date,
            "time": meeting.time,
            "friends": friends,
            "friend_details": friend_details,
            "centroid": {"latitude": centroid['latitude'], "longitude": centroid['longitude']},
            "optimal_station_by_total": result["optimal_station_by_total"],
            "details": result["details"],
        }), 200
    except Exception as e:
        print("Error while fetching meeting details:", e)
        return jsonify({"error": "서버 오류가 발생했습니다."}), 500

@app.route("/find-path")
def find_path():
    try:
        # URL 파라미터 가져오기
        sx = request.args.get('sx')
        sy = request.args.get('sy')
        ex = request.args.get('ex')
        ey = request.args.get('ey')
        
        # 파라미터 유효성 검사
        if not all([sx, sy, ex, ey]):
            return jsonify({"error": "Missing required parameters"}), 400

        # ODsay API 호출
        url = "https://api.odsay.com/v1/api/searchPubTransPathT"
        params = {
            "apiKey": ODSAY_API_KEY,
            "SX": sx,
            "SY": sy,
            "EX": ex,
            "EY": ey,
            "SearchType": 0,
        }
        
        response = requests.get(url, params=params)
        
        # 디버깅을 위한 로그
        print(f"ODsay API request URL: {url}")
        print(f"ODsay API parameters: {params}")
        print(f"ODsay API response status: {response.status_code}")
        print(f"ODsay API response: {response.text[:200]}...")

        if response.status_code == 200:
            data = response.json()
            
            # 응답 데이터 검증
            if 'result' not in data:
                return jsonify({"error": "Invalid response from ODsay API"}), 500
                
            # 경로가 없는 경우 처리
            if 'path' not in data['result']:
                return jsonify({"message": "No routes found"}), 404
                
            return jsonify(data)
        else:
            error_msg = f"ODsay API error: Status {response.status_code}"
            print(error_msg)
            return jsonify({"error": error_msg}), response.status_code
            
    except requests.exceptions.RequestException as e:
        error_msg = f"Network error in find_path: {str(e)}"
        print(error_msg)
        return jsonify({"error": error_msg}), 503
    except Exception as e:
        error_msg = f"Unexpected error in find_path: {str(e)}"
        print(error_msg)
        return jsonify({"error": error_msg}), 500



# 로그인 기능을 위한 코드



@app.route("/login", methods=["POST"])
def login():
    data = request.json
    name = data.get("name")
    input_password = data.get("password")

    if not name or not input_password:
        return jsonify({"status": "error", "message": "이름과 비밀번호를 입력하세요."}), 400

    user = Preference.query.filter_by(name=name).first()

    if user:
        if user.password == input_password:
            return jsonify({"status": "success", "message": f"'{name}'님 환영합니다."}), 200
        else:
            return jsonify({"status": "error", "message": "비밀번호가 잘못되었습니다."}), 401
    else:
        # 새로운 사용자 추가
        new_user = Preference(name=name, password=input_password, location="", latitude=0, longitude=0)
        db.session.add(new_user)
        db.session.commit()

        # DB 내용 출력
        preferences = Preference.query.all()
        print("\n현재 DB 상태:")
        for pref in preferences:
            print(f"ID: {pref.id}, 이름: {pref.name}, 비밀번호: {pref.password}, 위치: {pref.location}")
        print("-" * 50)

        return jsonify({"status": "success", "message": f"'{name}'님 환영합니다."}), 201


@app.route("/get-preference/<name>", methods=["GET"])
def get_preference(name):
    try:
        user = Preference.query.filter_by(name=name).first()
        if not user:
            return jsonify({"status": "error", "message": "사용자를 찾을 수 없습니다."}), 404

        return jsonify({
            "status": "success",
            "data": {
                "name": user.name,
                "location": user.location,
                "positive_prompt": user.positive_prompt,
                "negative_prompt": user.negative_prompt,
            }
        }), 200
    except Exception as e:
        print(f"사용자 정보 가져오기 실패: {e}")
        return jsonify({"status": "error", "message": "서버 오류가 발생했습니다."}), 500





with open('ChatSetup_final.json', 'r', encoding='utf-8') as f:
    config = json.load(f)

system_prompt = config['systemPrompt']
chat_parameters = config['chatParameters']

@app.route('/')
def index():
    return render_template('chat_test.html')

@app.route('/chat', methods=['POST'])
def chat():
    user_message = request.json['message']

    extra_body = {
        "data_sources": [{
            "type": "azure_search",
            "parameters": {
                "endpoint": f"{search_endpoint}",
                "index_name": "place-filtered-index2",
                "semantic_configuration": "place-filtered-semantic2",
                "query_type": "semantic",
                "fields_mapping": {},
                "in_scope": True,
                "role_information": system_prompt,
                "filter": None,
                "strictness": 3,
                "top_n_documents": 5,
                "authentication": {
                    "type": "api_key",
                    "key": f"{search_key}"
                }
            }
        }]
    }

    response = client.chat.completions.create(
        model=chat_parameters['deploymentName'],
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ],
        max_tokens=chat_parameters['maxResponseLength'],
        temperature=chat_parameters['temperature'],
        top_p=chat_parameters['topProbablities'],
        frequency_penalty=chat_parameters['frequencyPenalty'],
        presence_penalty=chat_parameters['presencePenalty'],
        stop=chat_parameters['stopSequences'],
        extra_body=extra_body
    )

    # 응답 텍스트 추출
    answer_text = response.choices[0].message.content

    # 인용 정보 추출 (안전한 방식으로)
    citations = []
    if hasattr(response.choices[0].message, 'context'):
        context = response.choices[0].message.context
        if isinstance(context, dict) and 'messages' in context:
            messages = context['messages']
            if isinstance(messages, list) and len(messages) > 0:
                first_message = messages[0]
                if isinstance(first_message, dict) and 'content' in first_message:
                    content = first_message['content']
                    if isinstance(content, dict) and 'citations' in content:
                        citations = content['citations']

    return jsonify({
        'response': answer_text,
        'citations': citations
    })

if __name__ == "__main__":
    app.run(debug=True, host = '0.0.0.0')
