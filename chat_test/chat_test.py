import json
from flask import Flask, render_template, request, jsonify
from openai import AzureOpenAI

app = Flask(__name__)

search_endpoint = "https://team6service.search.windows.net"
search_key = "6SpnKI68OU13s1mCRvfL2XaKNqEwIJjgAzmvbLmrB9AzSeCaYcUP"
client = AzureOpenAI(
    azure_endpoint=("https://recomo-openai.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2024-08-01-preview"),
    api_key=("2kt0epiqWh6zIwteoaMjEuto3624Q0LP1IBgEGKeSIKW2QOeNBKLJQQJ99ALACHYHv6XJ3w3AAABACOG9aZt"),
    api_version="2024-02-01"
)

# 설정 파일 로드
with open('ChatSetup.json', 'r', encoding='utf-8') as f:
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

if __name__ == '__main__':
    app.run(debug=True)

