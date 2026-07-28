from fastapi import APIRouter, Response
from barcode import Code128, EAN13, EAN8, UPCA
from barcode.writer import ImageWriter
import qrcode
import io
from PIL import Image
from typing import List

router = APIRouter()

@router.get("/generate/{barcode_type}")
def generate_barcode(barcode_type: str, data: str, width: int = 300, height: int = 100):
    buffer = io.BytesIO()
    try:
        if barcode_type.upper() == "CODE128":
            barcode = Code128(data, writer=ImageWriter())
        elif barcode_type.upper() == "EAN13":
            barcode = EAN13(data, writer=ImageWriter())
        elif barcode_type.upper() == "EAN8":
            barcode = EAN8(data, writer=ImageWriter())
        elif barcode_type.upper() == "UPC":
            barcode = UPCA(data, writer=ImageWriter())
        else:
            return {"error": "Unsupported barcode type"}
        barcode.write(buffer, options={"write_text": True, "module_height": 15})
        buffer.seek(0)
        img = Image.open(buffer)
        img = img.resize((width, height), Image.LANCZOS)
        out_buffer = io.BytesIO()
        img.save(out_buffer, format="PNG")
        out_buffer.seek(0)
        return Response(content=out_buffer.getvalue(), media_type="image/png")
    except Exception as e:
        return {"error": str(e)}

@router.get("/generate-qr")
def generate_qr(data: str, size: int = 300, error_correction: str = "M"):
    from qrcode.constants import ERROR_CORRECT_M, ERROR_CORRECT_H, ERROR_CORRECT_L, ERROR_CORRECT_Q
    ec_levels = {"L": ERROR_CORRECT_L, "M": ERROR_CORRECT_M, "Q": ERROR_CORRECT_Q, "H": ERROR_CORRECT_H}
    qr = qrcode.QRCode(version=None, error_correction=ec_levels.get(error_correction, ERROR_CORRECT_M), box_size=10, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    img = img.resize((size, size), Image.LANCZOS)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return Response(content=buffer.getvalue(), media_type="image/png")

@router.post("/bulk")
def generate_bulk_barcodes(items: List[dict]):
    results = []
    for item in items:
        results.append({"sku": item.get("sku"), "barcode": f"ARNX{item.get('sku', '')}", "qr_data": item.get("data", "")})
    return results

@router.get("/scan/{barcode}")
def scan_barcode(barcode: str):
    return {"barcode": barcode, "found": True, "product_id": "sample-id"}
