import azure.functions as func
import json

def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        data = req.get_json()
    except:
        return func.HttpResponse(
            json.dumps({"error": "Invalid JSON"}),
            mimetype="application/json",
            status_code=400
        )

    # Przykładowa logika
    name = data.get("name", "unknown user")

    response = {
        "status": "success",
        "message": f"Hello, {name}!",
        "received": data
    }

    return func.HttpResponse(
        json.dumps(response, ensure_ascii=False),
        mimetype="application/json",
        status_code=200
    )
