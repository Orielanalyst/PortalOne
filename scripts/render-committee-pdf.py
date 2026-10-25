"""Render the cited narrative, native map and coordinate/evidence appendices."""
import json, re, sys, html, io
from datetime import datetime, timezone, timedelta
from pathlib import Path
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Image, KeepTogether, Preformatted
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from pypdf import PdfReader

root=Path(sys.argv[1]).resolve(); data=json.loads((root/"input.json").read_text(encoding="utf-8")); dossier=data["dossier"]
source_numbers={citation["id"]:str(index+1) for index,citation in enumerate(data["citations"])}
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name="MissionTitle",fontName="Helvetica-Bold",fontSize=25,leading=29,textColor=colors.HexColor("#183d44"),spaceAfter=15))
styles.add(ParagraphStyle(name="MissionBody",fontName="Helvetica",fontSize=10,leading=15,spaceAfter=9,textColor=colors.HexColor("#273d43")))
styles.add(ParagraphStyle(name="MissionSmall",parent=styles["MissionBody"],fontSize=8,leading=11,spaceAfter=5,wordWrap="CJK"))
styles["Heading2"].textColor=colors.HexColor("#167c8a"); styles["Heading2"].spaceBefore=15; styles["Heading2"].spaceAfter=8
styles["Heading3"].spaceBefore=10
styles["Heading3"].fontName="Helvetica-Bold"; styles["Heading3"].fontSize=11; styles["Heading3"].leading=14
for heading in ("Heading1","Heading2","Heading3"): styles[heading].keepWithNext=True
width=174*mm; story=[]
def inline(text):
    value=html.escape(str(text).replace("→"," then "))
    value=re.sub(r"\*\*(.+?)\*\*",r"<b>\1</b>",value)
    value=re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)",r"<i>\1</i>",value)
    value=re.sub(r"`([^`]+)`",r'<font name="Courier">\1</font>',value)
    value=re.sub(r"\[(E[a-f0-9]{10})\]",lambda match:'<a href="#source-'+match[1]+'" color="#147384">['+source_numbers.get(match[1],match[1])+']</a>',value)
    return value
def p(text,small=False): return Paragraph(inline(text),styles["MissionSmall" if small else "MissionBody"])
def table(rows,widths=None):
    obj=Table([[p(cell,True) for cell in row] for row in rows],colWidths=widths,repeatRows=1,hAlign="LEFT")
    obj.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),colors.HexColor("#e8f0f0")),("VALIGN",(0,0),(-1,-1),"TOP"),("LINEBELOW",(0,0),(-1,0),.7,colors.HexColor("#8eb3b8")),("LINEBELOW",(0,1),(-1,-1),.3,colors.HexColor("#d7e1e2")),("TOPPADDING",(0,0),(-1,-1),6),("BOTTOMPADDING",(0,0),(-1,-1),6)])); return obj
def tokens(items):
    for item in items:
        kind=item["type"]
        if kind=="heading": story.append(Paragraph(inline(item["text"]),styles["Heading2" if item["depth"]<=2 else "Heading3"]))
        elif kind in ("paragraph","text"): story.append(p(item["text"]))
        elif kind=="list":
            for index,entry in enumerate(item["items"]):
                prefix=str(index+1)+". " if item.get("ordered") else "• "
                story.append(p(prefix+entry["text"]))
        elif kind=="table":
            headers=[cell["text"] for cell in item["header"]]
            if len(headers)>=6:
                for row in item["rows"]:
                    values=[cell["text"] for cell in row]
                    block=[Paragraph(inline("Action "+values[0]+" | "+values[1]),styles["Heading3"])]
                    block += [p("**"+label+":** "+value,True) for label,value in zip(headers[2:],values[2:])]
                    story.append(KeepTogether(block)); story.append(Spacer(1,3*mm))
            else: story.append(table([headers]+[[cell["text"] for cell in row] for row in item["rows"]],[width/len(headers)]*len(headers)))
        elif kind=="blockquote": tokens(item["tokens"])
        elif kind=="code": story.append(Preformatted(item["text"],styles["Code"],maxLineLength=90))

captured=datetime.fromisoformat(dossier["capturedAt"].replace("Z","+00:00")).astimezone(timezone(timedelta(hours=1)))
story += [p("RELIEFINTEL | MISSION COMMITTEE",True),Paragraph("Evidence and intervention proposal",styles["MissionTitle"]),
    p("**Committee review draft | Operational hold**"),p("Prepared "+captured.strftime("%d %B %Y, %H:%M WAT")),p(dossier["objective"]),
    p("This pack records the current evidence, recommended verification and intervention priorities, and the conditions that must be satisfied before an operational decision. Demonstration reports and synthetic resources do not establish actual field conditions."),
    p("Proposed roles and named counterparties in the draft are suggestions requiring committee confirmation. Their presence, participation and appointment have not been verified; confirm an actual responsible person before assigning work."),
    p("Evidence revision: "+dossier["revision"],True),Spacer(1,5*mm)]
tokens(data["tokens"])
story += [PageBreak(),Paragraph("Mapped evidence and coverage",styles["Heading1"]),p("Native QGIS rendering. The scale bar applies to this reproduced map; the full-resolution map PDF and editable QGIS project are included in the pack."),Image(str(root/"map.png"),width=width,height=width*210/297)]
story += [p("Road geometry indicates mapped existence. It does not establish present passability. Blockage points require report coordinates; no point is invented for an unlocated claim. Intervention candidates are community references, not surveyed zones.")]
story.append(KeepTogether([Paragraph("Required evidence gaps",styles["Heading2"])] + [p("• "+gap) for gap in dossier["gaps"]]))
story += [PageBreak(),Paragraph("Health facility reference inventory",styles["Heading1"]),p("Coordinates are WGS84 (EPSG:4326). Polygon-derived coordinates are an existing boundary vertex, not a centroid, entrance or ambulance access point. Capacity and operation remain unverified.")]
rows=[["Mapped health feature / source","Type","Latitude","Longitude","Capacity"]]
for feature in dossier["layers"]["facilities"]["features"]:
    prop=feature["properties"]; basis="Boundary reference" if prop["coordinate_basis"].startswith("source_boundary") else "Mapped point"
    rows.append([prop["name"]+" ["+prop["evidence_id"]+"] "+basis,"Health feature; source tag yes" if prop["type"]=="yes" else prop["type"],str(prop["latitude"]),str(prop["longitude"]),"Not reported"])
story.append(table(rows,[66*mm,24*mm,27*mm,27*mm,30*mm]))
story += [PageBreak(),Paragraph("Named community coordinate references",styles["Heading1"]),p("Duplicate names remain separate source features. These coordinates locate mapped communities, not incidents or beneficiary boundaries.")]
rows=[["Community","OSM feature reference","Latitude","Longitude"]]
for feature in dossier["layers"]["places"]["features"]:
    prop=feature["properties"]; xy=feature["geometry"]["coordinates"]
    rows.append([prop.get("name","Unnamed source feature"),str(prop.get("id",feature.get("id"))),str(xy[1]),str(xy[0])])
story.append(table(rows,[49*mm,65*mm,30*mm,30*mm]))
story += [PageBreak(),Paragraph("Evidence register",styles["Heading1"]),p("References link the narrative to the source record, dataset or deterministic query receipt. The accompanying evidence.json retains full statements, record identifiers, source links and hashes.")]
for citation in data["citations"]:
    title='<a name="source-'+citation["id"]+'"/>'+html.escape('['+source_numbers[citation["id"]]+'] '+citation["title"])
    entry=[Paragraph(title,styles["Heading3"]),p('Source ID: '+citation["id"],True)]
    statement=citation["statement"]
    query=None
    if citation["kind"]=="query" and statement.startswith("{"):
        query=json.loads(statement)
        statement=f"Bounded community/resource query result: {query['reports']} reports, {query['demonstration']} demonstration, {query['liveLabelled']} live-labelled and {query['forwarded']} forwarded. Candidate rows can share ambiguous reports; do not sum them as independent observations. Resource values below are source references, not actual confirmed NGO resources."
    entry.append(p(statement,True))
    if query:
        rows=[["Community candidate","Reports demo/live","Stock reference","Fleet reference","Status"]]
        for row in query["communities"]:
            stock="No confirmation" if row["stockUnits"] is None else str(row["stockUnits"])+" units x "+str(row["unitMassKg"])+" kg"
            fleet="No confirmation" if row["fleetCount"] is None else str(row["fleetCount"])+" vehicles"
            expired=(row["stockUnits"] is not None and not row["stockFresh"]) or (row["fleetCount"] is not None and not row["fleetFresh"])
            status=("Synthetic; " if row["logisticsSimulated"] else "")+("expired" if expired else "unconfirmed" if row["stockUnits"] is None and row["fleetCount"] is None else "source-current; unverified")
            rows.append([row["name"],str(row["demo"])+" / "+str(row["live"]),stock,fleet,status])
        entry.append(table(rows,[35*mm,27*mm,39*mm,32*mm,41*mm]))
    if citation.get("sourceUrl"): entry.append(Paragraph('<link href="'+html.escape(citation["sourceUrl"],quote=True)+'" color="#147384">Open original source</link> | '+html.escape(citation["recordId"]),styles["MissionSmall"]))
    else: entry.append(p("Traceable record: "+citation["recordId"],True))
    story.append(KeepTogether(entry))
story += [Paragraph("GIS handoff and symbology",styles["Heading2"]),p("Open mission.qgz to load the styled GeoPackage. Individual GeoJSON layers are also included. Roads are gray; health features teal crosses; reported access constraints red; intervention zones amber; community verification candidates amber points. Empty blockage/zone layers represent missing located evidence, not an all-clear. Source layers use EPSG:4326 and the map display uses EPSG:32632."),p(dossier["attribution"]+" | ODbL 1.0. HOT and OSM are the same underlying source, not independent corroboration."),p("End of committee draft. No dispatch authorization is issued by this document.")]
def footer(canvas,doc):
    canvas.saveState(); canvas.setStrokeColor(colors.HexColor("#c3d6d9")); canvas.line(18*mm,16*mm,192*mm,16*mm)
    canvas.setFont("Helvetica",8); canvas.setFillColor(colors.HexColor("#587078")); canvas.drawString(18*mm,11*mm,"RELIEFINTEL | Committee draft | Operational hold"); canvas.drawRightString(192*mm,11*mm,str(doc.page)); canvas.restoreState()
doc=SimpleDocTemplate(str(root/"report.pdf"),pagesize=A4,rightMargin=18*mm,leftMargin=18*mm,topMargin=18*mm,bottomMargin=23*mm,title="ReliefIntel committee evidence and intervention proposal",author="ReliefIntel Mission Coordinator")
doc.build(story,onFirstPage=footer,onLaterPages=footer)
reader=PdfReader(str(root/"report.pdf")); text="\n".join(page.extract_text() or "" for page in reader.pages)
if len(reader.pages)<3 or re.search(r"\b(TBD|lorem ipsum)\b",text,re.I): raise RuntimeError("PDF content verification failed")
(root/"pdf-validation.json").write_text(json.dumps({"pages":len(reader.pages),"textCharacters":len(text),"placeholders":False,"mapIncluded":True},indent=2),encoding="utf-8")
print(json.dumps({"pages":len(reader.pages),"pdfWritten":True}))
