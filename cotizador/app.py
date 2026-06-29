from flask import Flask, render_template, request, jsonify
from main import cotizar
from calculator import get_jpy_to_clp

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/admin")
def admin():
    return render_template("admin.html")


@app.route("/tipo-cambio")
def tipo_cambio():
    try:
        tasa, fuente = get_jpy_to_clp()
        return jsonify({"tasa": round(tasa, 6), "fuente": fuente})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/cotizar", methods=["POST"])
def cotizar_endpoint():
    data = request.get_json(silent=True) or {}
    part_number = data.get("part_number", "").strip()

    if not part_number:
        return jsonify({"estado": "error", "mensaje": "Ingresa un número de parte"}), 400

    override = data.get("tipo_cambio_override")
    try:
        override = float(override) if override else None
    except (ValueError, TypeError):
        override = None

    resultado = cotizar(part_number, tipo_cambio_override=override)
    return jsonify(resultado)


if __name__ == "__main__":
    print("\n  Cotizador OEM — http://localhost:5000")
    print("  Admin         — http://localhost:5000/admin\n")
    app.run(debug=False, port=5000, threaded=True)
