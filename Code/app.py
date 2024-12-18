from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_sqlalchemy import SQLAlchemy
import os
import json

app = Flask(__name__, template_folder="frontend", static_folder="frontend")

# 데이터베이스 설정
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///preferences.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

# DB 모델
class Preference(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    location = db.Column(db.String(120), nullable=False)
    positive_prompt = db.Column(db.Text, nullable=True)
    negative_prompt = db.Column(db.Text, nullable=True)

class Moim(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    meeting_name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=False)  # 설명 필드 추가
    date = db.Column(db.String(50), nullable=False)
    time = db.Column(db.String(50), nullable=False)
    friends = db.Column(db.Text, nullable=False)  # 친구들의 이름 리스트
    friend_details = db.Column(db.Text, nullable=False)  # 위치, 선호, 비선호 리스트

# 애플리케이션 시작 시 DB 생성
with app.app_context():
    db.create_all()

# 시작 페이지: HomePage.html
@app.route("/")
def home():
    return render_template("HomePage.html")

# CreatePreferences.html 렌더링
@app.route("/create-preferences")
def create_preferences():
    return render_template("CreatePreferences.html")

# 취향 데이터 저장 및 DB 내용 출력
@app.route("/save-preference", methods=["POST"])
def save_preference():
    data = request.json
    name = data.get("name")
    location = data.get("location")
    positive_prompt = data.get("positivePrompt")
    negative_prompt = data.get("negativePrompt")

    # 중복 이름 확인 및 업데이트
    existing_record = Preference.query.filter_by(name=name).first()
    if existing_record:
        existing_record.location = location
        existing_record.positive_prompt = positive_prompt
        existing_record.negative_prompt = negative_prompt
        message = "정보가 변경되었습니다."
    else:
        # 새로운 데이터 저장
        new_pref = Preference(
            name=name,
            location=location,
            positive_prompt=positive_prompt,
            negative_prompt=negative_prompt,
        )
        db.session.add(new_pref)
        message = "데이터가 저장되었습니다."

    db.session.commit()

    # DB 테이블 내용 출력
    print("\n현재 저장된 Preferences 테이블:")
    preferences = Preference.query.all()
    for pref in preferences:
        print(f"ID: {pref.id}, 이름: {pref.name}, 위치: {pref.location}, 선호 기준: {pref.positive_prompt}, 제외 조건: {pref.negative_prompt}")
    print("-" * 50)

    return jsonify({"status": "success", "message": message}), 200


# 정적 파일 경로 설정 (CSS, JS 등)
@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(app.static_folder, filename)

@app.route("/get-friends-names", methods=["GET"])
def get_friend_names():
    """친구 이름 목록 반환"""
    try:
        friends = Preference.query.with_entities(Preference.name).all()
        friend_names = [friend.name for friend in friends]
        return jsonify({"names": friend_names})
    except Exception as e:
        print("Error:", e)
        return jsonify({"error": "친구 이름을 불러오는 중 오류가 발생했습니다."}), 500


@app.route("/get-meetings", methods=["GET"])
def get_meetings():
    """저장된 모임 데이터를 반환"""
    try:
        meetings = Moim.query.all()
        result = [
            {
                "id": meeting.id,  # 모임 ID 추가
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
    """모임 정보를 저장하는 라우트"""
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

        # 모임 중복 확인
        existing_meeting = Moim.query.filter_by(meeting_name=meeting_name, date=date, time=time).first()
        if existing_meeting:
            return jsonify({"status": "duplicate", "message": "이미 같은 이름과 시간의 모임이 존재합니다."}), 200

        # 선택된 친구들의 세부 정보 가져오기
        friends = Preference.query.filter(Preference.name.in_(selected_friends)).all()
        if not friends:
            return jsonify({"status": "error", "message": "선택된 친구의 정보가 없습니다."}), 404

        friend_details = {
            "location": [friend.location for friend in friends if friend.location],
            "positive_prompt": [friend.positive_prompt for friend in friends if friend.positive_prompt],
            "negative_prompt": [friend.negative_prompt for friend in friends if friend.negative_prompt],
        }

        # 데이터 저장
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
    return render_template("Recommend.html", meeting_name=meeting_name)

from urllib.parse import unquote

@app.route("/get-meeting-details/<path:meeting_name>", methods=["GET"])
def get_meeting_details(meeting_name):
    """모임 이름으로 모임 데이터를 가져오는 API"""
    try:
        decoded_name = unquote(meeting_name)  # URL 디코딩 처리
        meeting = Moim.query.filter_by(meeting_name=decoded_name).first()
        if not meeting:
            return jsonify({"error": "모임 정보를 찾을 수 없습니다."}), 404

        return jsonify({
            "name": meeting.meeting_name,
            "description": meeting.description,
            "date": meeting.date,
            "time": meeting.time,
            "friends": json.loads(meeting.friends),
            "friend_details": json.loads(meeting.friend_details),
        }), 200
    except Exception as e:
        print("Error while fetching meeting details:", e)
        return jsonify({"error": "서버 오류가 발생했습니다."}), 500










if __name__ == "__main__":
    app.run(debug=True)
