from pathlib import Path

from reportlab import rl_config
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import (
    Flowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

rl_config.invariant = 1

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "emovo-care-public-source-business-plan_v1.pdf"
AS_OF = "19 July 2026"
MANIFEST_ID = "PROOFLINE-PUBLIC-DEMO-EMOVO-2026-07-19-V1"

INK = colors.HexColor("#17211B")
MUTED = colors.HexColor("#5D6861")
GREEN = colors.HexColor("#176C4A")
GREEN_SOFT = colors.HexColor("#E8F4EE")
BLUE = colors.HexColor("#2457D6")
BLUE_SOFT = colors.HexColor("#EDF2FF")
AMBER = colors.HexColor("#A46309")
AMBER_SOFT = colors.HexColor("#FFF3DA")
RED = colors.HexColor("#9D3B30")
LINE = colors.HexColor("#D9DED9")
PAPER = colors.HexColor("#FCFBF7")
WHITE = colors.white


class Rule(Flowable):
    def __init__(self, color=LINE, width=0.7, space_before=2, space_after=8):
        super().__init__()
        self.color = color
        self.rule_width = width
        self.space_before = space_before
        self.space_after = space_after
        self.height = space_before + space_after + width

    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(self.rule_width)
        self.canv.line(0, self.space_after, self._availWidth, self.space_after)

    def wrap(self, avail_width, avail_height):
        self._availWidth = avail_width
        return avail_width, self.height


class RiskBar(Flowable):
    def __init__(self, label, value, note, color=BLUE):
        super().__init__()
        self.label = label
        self.value = max(0, min(100, value))
        self.note = note
        self.color = color
        self.height = 16 * mm

    def wrap(self, avail_width, avail_height):
        self.width = avail_width
        return avail_width, self.height

    def draw(self):
        canvas = self.canv
        canvas.setFont("Helvetica-Bold", 8.5)
        canvas.setFillColor(INK)
        canvas.drawString(0, 11 * mm, self.label)
        canvas.setFont("Helvetica", 7.4)
        canvas.setFillColor(MUTED)
        note_width = stringWidth(self.note, "Helvetica", 7.4)
        canvas.drawString(max(0, self.width - note_width), 11 * mm, self.note)
        canvas.setFillColor(colors.HexColor("#E5EAE6"))
        canvas.roundRect(0, 5.5 * mm, self.width, 3.3 * mm, 1.65 * mm, fill=1, stroke=0)
        canvas.setFillColor(self.color)
        canvas.roundRect(0, 5.5 * mm, self.width * self.value / 100, 3.3 * mm, 1.65 * mm, fill=1, stroke=0)


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="CoverKicker",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=9,
    leading=12,
    textColor=GREEN,
    spaceAfter=10,
    uppercase=True,
))
styles.add(ParagraphStyle(
    name="CoverTitle",
    parent=styles["Title"],
    fontName="Helvetica-Bold",
    fontSize=29,
    leading=33,
    textColor=INK,
    alignment=TA_LEFT,
    spaceAfter=10,
))
styles.add(ParagraphStyle(
    name="CoverSubtitle",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=13,
    leading=18,
    textColor=MUTED,
    spaceAfter=18,
))
styles.add(ParagraphStyle(
    name="H1x",
    parent=styles["Heading1"],
    fontName="Helvetica-Bold",
    fontSize=21,
    leading=25,
    textColor=INK,
    spaceBefore=4,
    spaceAfter=8,
))
styles.add(ParagraphStyle(
    name="H2x",
    parent=styles["Heading2"],
    fontName="Helvetica-Bold",
    fontSize=13,
    leading=16,
    textColor=INK,
    spaceBefore=8,
    spaceAfter=5,
))
styles.add(ParagraphStyle(
    name="Bodyx",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=9.2,
    leading=13.2,
    textColor=INK,
    spaceAfter=7,
))
styles.add(ParagraphStyle(
    name="Smallx",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=7.6,
    leading=10.5,
    textColor=MUTED,
    spaceAfter=4,
))
styles.add(ParagraphStyle(
    name="Eyebrowx",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=7.5,
    leading=10,
    textColor=GREEN,
    spaceAfter=3,
))
styles.add(ParagraphStyle(
    name="CalloutTitle",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=9.5,
    leading=12,
    textColor=INK,
    spaceAfter=4,
))
styles.add(ParagraphStyle(
    name="CalloutBody",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=8.2,
    leading=11.5,
    textColor=INK,
))
styles.add(ParagraphStyle(
    name="TableHead",
    parent=styles["Normal"],
    fontName="Helvetica-Bold",
    fontSize=7.5,
    leading=9,
    textColor=WHITE,
))
styles.add(ParagraphStyle(
    name="TableCell",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=7.3,
    leading=9.6,
    textColor=INK,
))
styles.add(ParagraphStyle(
    name="Source",
    parent=styles["Normal"],
    fontName="Helvetica",
    fontSize=6.7,
    leading=9.3,
    textColor=INK,
    spaceAfter=5,
    allowWidows=0,
    allowOrphans=0,
))


def p(text, style="Bodyx"):
    return Paragraph(text, styles[style])


def box(title, body, background=BLUE_SOFT, border=BLUE):
    table = Table([[p(title, "CalloutTitle")], [p(body, "CalloutBody")]], colWidths=[170 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), background),
        ("BOX", (0, 0), (-1, -1), 0.7, border),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, 0), 8),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 9),
        ("TOPPADDING", (0, 1), (-1, 1), 0),
    ]))
    return table


def bullet(text):
    return p(f"- {text}", "Bodyx")


def fact_table(rows, widths=(42 * mm, 128 * mm)):
    data = [[p("FIELD", "TableHead"), p("PUBLIC-SOURCE FACT", "TableHead")]]
    data.extend([[p(left, "TableCell"), p(right, "TableCell")] for left, right in rows])
    table = Table(data, colWidths=list(widths), repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("GRID", (0, 0), (-1, -1), 0.45, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#F1F3F0")),
    ]))
    return table


def section_title(kicker, title, intro=None):
    items = [p(kicker.upper(), "Eyebrowx"), p(title, "H1x")]
    if intro:
        items.append(p(intro, "Bodyx"))
    items.append(Rule())
    return items


def header_footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, width, height, fill=1, stroke=0)
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(20 * mm, height - 15 * mm, width - 20 * mm, height - 15 * mm)
    canvas.setFont("Helvetica-Bold", 6.8)
    canvas.setFillColor(GREEN)
    canvas.drawString(20 * mm, height - 11.5 * mm, "PROOFLINE PUBLIC-SOURCE DEMO")
    canvas.setFont("Helvetica", 6.8)
    canvas.setFillColor(MUTED)
    right = f"Emovo Care - as of {AS_OF}"
    canvas.drawRightString(width - 20 * mm, height - 11.5 * mm, right)
    canvas.line(20 * mm, 14 * mm, width - 20 * mm, 14 * mm)
    canvas.setFont("Helvetica", 6.2)
    canvas.setFillColor(MUTED)
    canvas.drawString(20 * mm, 9.5 * mm, "Not authored or approved by Emovo Care. Public-source demo only. Not an offering document.")
    canvas.drawRightString(width - 20 * mm, 9.5 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=19 * mm,
        title="Emovo Care Public-Source Demo Business Plan",
        author="Proofline",
        subject="Public-source demo investment case; not company-authored",
        creator="Proofline v3",
    )

    story = []
    story += [Spacer(1, 24 * mm), p("PUBLIC-SOURCE DEMO BUSINESS PLAN", "CoverKicker")]
    story += [p("Emovo Care", "CoverTitle")]
    story += [p("Wearable hand robotics for rehabilitation and assisted movement", "CoverSubtitle")]
    cover_metrics = Table([
        [p("PUBLIC COMPANY FACT", "Eyebrowx"), p("PUBLIC COMPANY FACT", "Eyebrowx"), p("PUBLIC COMPANY FACT", "Eyebrowx")],
        [p("CE-marked", "H2x"), p("Revenue generating", "H2x"), p("Second batch sold", "H2x")],
        [p("EU MDR device", "Smallx"), p("Venturelab profile", "Smallx"), p("May 2026 milestone", "Smallx")],
    ], colWidths=[56.6 * mm] * 3)
    cover_metrics.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GREEN_SOFT),
        ("BOX", (0, 0), (-1, -1), 0.7, GREEN),
        ("INNERGRID", (0, 0), (-1, -1), 0.45, colors.HexColor("#BCD7C8")),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story += [cover_metrics, Spacer(1, 12 * mm)]
    story += [box(
        "READ THIS FIRST",
        "This document was compiled by Proofline from public sources for a product demonstration. It is not a confidential company business plan, was not authored or approved by Emovo Care, and is not an offering document, investment recommendation, commitment, or promise of funding. Verified public facts are separated from Proofline interpretations and unverified planning assumptions.",
        AMBER_SOFT,
        AMBER,
    )]
    story += [Spacer(1, 9 * mm), p(f"Evidence cut-off: {AS_OF}<br/>Manifest: {MANIFEST_ID}<br/>Prepared by Proofline v3", "Smallx")]
    story += [PageBreak()]

    story += section_title("1 / Executive case", "The opportunity in one page", "A compact, citation-led view of what is publicly supported, what remains unknown, and why the company is useful for a deterministic Proofline demo.")
    story += [p("INVESTMENT CASE", "Eyebrowx")]
    story += [p("Emovo Care is a Swiss medical-robotics company commercializing a motorized hand orthosis. Its current product page describes Emovo Clinic as commercially available and CE-marked under EU MDR. A Venturelab profile reports revenue generation and dated first- and second-batch sales. Independent EPFL reporting describes hospital and rehabilitation-center testing. [S1, S3, S4]", "Bodyx")]
    story += [p("WHY NOW", "Eyebrowx")]
    story += [p("The public-health backdrop is material: WHO estimates 2.4 billion people may benefit from rehabilitation and documents access constraints including workforce shortages and long waits. NHS England explicitly prioritizes improved post-hospital stroke rehabilitation. These sources establish problem pull, not automatic product adoption. [S7, S8, S9]", "Bodyx")]
    story += [p("COMMERCIAL SIGNAL", "Eyebrowx")]
    story += [p("Public evidence has advanced beyond grant-only validation: Venturelab lists a five-figure sale in 2021, CE marking in October 2025, first batch sales in December 2025, and second batch sales in May 2026. Exact revenue, price, margin, recurrence, customer count, and concentration remain undisclosed. [S3]", "Bodyx")]
    story += [Spacer(1, 3 * mm)]
    story += [box(
        "Proofline screen",
        "The packaged demo snapshot covers founder execution, market pull, product and technical fit, and three of four commercial criteria. Unit economics remains deliberately unknown. Under the configured fixed-check policy, the reviewed snapshot is policy-eligible for a USD 100,000 human review. That status is non-binding and does not reserve capital.",
        GREEN_SOFT,
        GREEN,
    )]
    story += [Spacer(1, 6 * mm), p("PUBLIC-EVIDENCE COVERAGE", "Eyebrowx")]
    story += [RiskBar("Founder execution evidence", 65, "covered; reviewed public milestones", GREEN)]
    story += [RiskBar("Market / problem pull", 66, "covered; health-system sources", BLUE)]
    story += [RiskBar("Product / technical fit", 69, "covered; certification + research", BLUE)]
    story += [RiskBar("Revenue plausibility", 59, "unit economics remains unknown", AMBER)]
    story += [p("The values above are the deterministic Proofline evidence scores for this frozen snapshot, not success probabilities, valuations, or founder-worth ratings.", "Smallx")]
    story += [PageBreak()]

    story += section_title("2 / Company and team", "Public company profile", "Only facts traceable to the cited company, ecosystem, university, or public-institution sources are presented as verified public facts.")
    story += [fact_table([
        ("Legal entity", "Emovo Care SA; company identifier CHE-373.504.143. [S1]"),
        ("Incorporation", "12 June 2020, as reported by Venturelab. [S3]"),
        ("Location", "Biopole, Epalinges, Vaud, Switzerland. [S1]"),
        ("Founders", "Luca Randazzo, co-founder and CEO; Iselin Froybu, co-founder and COO. [S2]"),
        ("Current product", "Emovo Clinic, a motorized hand orthosis for active hand opening and closing. [S1]"),
        ("Regulatory status", "CE-marked medical device under EU MDR, according to the company. [S1]"),
        ("Commercial status", "Commercially available today, according to the company; Venturelab says the company is generating revenues. [S1, S3]"),
        ("Research product line", "Active hand exoskeletons with one to five degrees of freedom, sensors, and software APIs; explicitly marked research-use only and non-certified. [S1]"),
    ])]
    story += [Spacer(1, 6 * mm), p("EXECUTION TIMELINE", "H2x")]
    timeline = [
        ("2017", "First patent submission listed in Venturelab's milestone ledger. [S3]"),
        ("2019-2020", "Venture Kick program and CHF 150,000 award; more than 150 stakeholder interviews and tests reported. [S5]"),
        ("2020", "Company incorporated. [S3]"),
        ("2021", "ISO 13485 certification and a five-figure sale listed by Venturelab. [S3]"),
        ("2022-2023", "EPFL describes hospital testing; FIT provides a CHF 100,000 Tech Seed loan for market validation and proof-of-concept sales streams. [S4, S6]"),
        ("2025", "CE mark and first batch sales listed in October and December. [S3]"),
        ("2026", "Second batch sales listed in May; current product page says commercially available. [S1, S3]"),
    ]
    story += [fact_table(timeline, widths=(25 * mm, 145 * mm))]
    story += [Spacer(1, 5 * mm), box(
        "Founder-scoring boundary",
        "Proofline uses only observable, attributable execution evidence. It excludes protected traits, school or employer prestige, followers, popularity, and inferred personal characteristics. The team timeline is evidence of delivery and regulated-hardware execution, not a measure of personal worth.",
        BLUE_SOFT,
        BLUE,
    )]
    story += [PageBreak()]

    story += section_title("3 / Problem and customer", "Rehabilitation access meets hand-function need", "The problem case combines condition-specific public reporting with independent health-system and global-health sources.")
    story += [p("PROBLEM", "Eyebrowx")]
    story += [p("Loss of grasping function after stroke or injury can make everyday activities difficult. EPFL reported in 2022 that nearly 12 million people worldwide survive a stroke each year and roughly half retain some limitation in hand use. It also described many portable robotic systems as too complex or expensive for daily use. [S4]", "Bodyx")]
    story += [p("SYSTEM CONSTRAINT", "Eyebrowx")]
    story += [p("WHO estimates 2.4 billion people live with a condition that may benefit from rehabilitation. It describes unmet need, long waiting times, shortages of trained professionals, funding gaps, and limited access to assistive technology. WHO's rehabilitation workforce initiative separately calls the global rehabilitation workforce shortage a large unmet need. [S7, S8]", "Bodyx")]
    story += [p("BUYER CONTEXT", "Eyebrowx")]
    story += [p("Potential institutional users include clinics, rehabilitation centers, hospitals, and research institutions. NHS England's stroke program seeks improved post-hospital rehabilitation models and broader recovery reviews, providing a real incumbent need signal. A need signal is not a purchase order, budget allocation, or customer commitment. [S4, S9]", "Bodyx")]
    problem_table = Table([
        [p("USER / BUYER", "TableHead"), p("JOB TO BE DONE", "TableHead"), p("PUBLIC EVIDENCE", "TableHead")],
        [p("Clinician or rehabilitation team", "TableCell"), p("Extend active hand movement practice across clinical and domestic settings.", "TableCell"), p("Company use cases; EPFL hospital testing. [S1, S4]", "TableCell")],
        [p("Research institution", "TableCell"), p("Use configurable exoskeleton hardware, sensors, and APIs for neurorehabilitation research.", "TableCell"), p("Emovo Research product description. [S1]", "TableCell")],
        [p("Person using rehabilitation", "TableCell"), p("Perform meaningful grasp and release activities with a portable system.", "TableCell"), p("Company product features; EPFL description. [S1, S4]", "TableCell")],
        [p("Health system", "TableCell"), p("Improve reach and continuity of post-hospital rehabilitation under capacity constraints.", "TableCell"), p("WHO access constraints; NHS priorities. [S7-S9]", "TableCell")],
    ], colWidths=[42 * mm, 72 * mm, 56 * mm], repeatRows=1)
    problem_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("GRID", (0, 0), (-1, -1), 0.45, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story += [Spacer(1, 5 * mm), problem_table]
    story += [Spacer(1, 5 * mm), box(
        "Market-sizing caution",
        "Prevalence and unmet need are not revenue. A defensible market model still requires reachable account counts, price, reimbursement, purchasing authority, replacement cycles, utilization, and adoption assumptions.",
        AMBER_SOFT,
        AMBER,
    )]
    story += [PageBreak()]

    story += section_title("4 / Product and evidence", "A portable, regulated hand-robotics platform", "The product case separates current certified use, research-only configurations, and adjacent peer-reviewed research.")
    story += [fact_table([
        ("Function", "Active hand opening and closing with a motorized orthosis. [S1]"),
        ("Use settings", "Clinical and domestic settings; one device can serve multiple patients. [S1]"),
        ("Fit and control", "Adaptable to different hand morphologies and left or right hands; controlled through soft push-buttons. [S1]"),
        ("Modularity", "Can be combined with off-the-shelf splints for different scenarios. [S1]"),
        ("Architecture", "Venture Kick described patent-protected artificial tendons and lightweight, wearable, modular components. [S5]"),
        ("Independent development evidence", "EPFL reported multiple rounds of testing and successful tests in hospitals and rehabilitation centers. [S4]"),
        ("Certification", "Company describes Emovo Clinic as CE-marked under EU MDR. [S1]"),
        ("Research line boundary", "One-to-five degree-of-freedom exoskeleton variants with sensors and software APIs are explicitly non-certified and for research use only. [S1]"),
    ])]
    story += [Spacer(1, 6 * mm), p("ACADEMIC AND TECHNICAL ALIGNMENT", "H2x")]
    story += [p("A 2020 pilot study in the Journal of NeuroEngineering and Rehabilitation evaluated a self-administered home program using a soft robotic hand glove for people with chronic spinal-cord injury and reported improvement in hand function. A 2025 randomized study reported that combined conventional and robotic hand rehabilitation improved multiple post-stroke outcomes more than either protocol alone. [S10, S11]", "Bodyx")]
    story += [box(
        "What this research does and does not establish",
        "The studies support mechanism and delivery-setting alignment. They do not establish the clinical efficacy, comparative effectiveness, safety, reimbursement, or adoption of Emovo Clinic. Product-specific evidence must be reviewed separately.",
        AMBER_SOFT,
        AMBER,
    )]
    story += [Spacer(1, 6 * mm), p("DEFENSIBILITY QUESTIONS FOR FULL DILIGENCE", "H2x")]
    story += [bullet("Obtain CE certificate, intended-use statement, risk class, notified-body details, and post-market surveillance plan.")]
    story += [bullet("Review patent families and claim scope, including freedom-to-operate against hand-orthosis competitors.")]
    story += [bullet("Request product-specific clinical, usability, safety, and durability datasets with protocols and adverse events.")]
    story += [bullet("Verify manufacturing process capability, quality-system audit status, supplier concentration, and service requirements.")]
    story += [PageBreak()]

    story += section_title("5 / Commercial plan", "A real sales signal, with material economics still unknown", "This section distinguishes public commercial evidence from Proofline's planning hypotheses for a future data room.")
    story += [p("PUBLICLY SUPPORTED", "Eyebrowx")]
    story += [fact_table([
        ("Availability", "Emovo Clinic is commercially available today, according to the company. [S1]"),
        ("Revenue", "Venturelab states that Emovo Care is generating revenues. [S3]"),
        ("Historic sale", "Venturelab lists a five-figure sale in April 2021. [S3]"),
        ("Batch sales", "First batch sales in December 2025 and second batch sales in May 2026 are listed as milestones. [S3]"),
        ("Customer path", "The company invites product inquiries; EPFL reported plans to provide devices to clinics and research institutions. [S1, S4]"),
        ("Non-dilutive support", "CHF 150,000 from Venture Kick in 2020 and a CHF 100,000 FIT Tech Seed loan in 2023. [S5, S6]"),
    ])]
    story += [Spacer(1, 5 * mm), p("PROOFLINE PLANNING HYPOTHESES - NOT COMPANY GUIDANCE", "Eyebrowx")]
    hypothesis_data = [
        [p("HYPOTHESIS", "TableHead"), p("WHY IT IS PLAUSIBLE", "TableHead"), p("EVIDENCE REQUIRED", "TableHead")],
        [p("Direct clinical sales remain the initial motion.", "TableCell"), p("Current direct inquiry and clinic use case. [S1]", "TableCell"), p("Pipeline by stage, sales-cycle distribution, conversion, procurement owners.", "TableCell")],
        [p("Research systems can create an earlier, lower-regulatory-friction segment.", "TableCell"), p("Separate research product line with sensors and APIs. [S1]", "TableCell"), p("Research-unit sales, pricing, gross margin, support load, renewal or upgrade behavior.", "TableCell")],
        [p("Domestic use may expand utilization per device.", "TableCell"), p("Product is described for clinical and domestic settings. [S1]", "TableCell"), p("Training burden, adherence, safety, reimbursement, remote monitoring, logistics.", "TableCell")],
        [p("Institutional distribution partners could accelerate geography expansion.", "TableCell"), p("Common medtech route, but no public partner is identified.", "TableCell"), p("Signed partner terms, margin stack, exclusivity, minimum orders, territory coverage.", "TableCell")],
    ]
    hypothesis_table = Table(hypothesis_data, colWidths=[54 * mm, 54 * mm, 62 * mm], repeatRows=1)
    hypothesis_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), AMBER),
        ("GRID", (0, 0), (-1, -1), 0.45, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("BACKGROUND", (0, 1), (-1, -1), AMBER_SOFT),
    ]))
    story += [hypothesis_table, Spacer(1, 5 * mm)]
    story += [box(
        "No fabricated forecast",
        "Public sources do not disclose product price, revenue amount, gross margin, bill of materials, customer acquisition cost, lifetime value, sales cycle, backlog, churn, or valuation. This demo therefore does not invent a revenue forecast or valuation. Those fields remain explicit diligence requests.",
        AMBER_SOFT,
        AMBER,
    )]
    story += [PageBreak()]

    story += section_title("6 / Risk, diligence, and milestones", "What must be true for the case to compound", "A high-quality screen exposes unresolved risks rather than hiding them inside a single score.")
    risk_rows = [
        ("Clinical and regulatory", "CE-marking is publicly stated, but certificate scope, intended use, post-market data, and product-specific outcomes require primary review.", "Certificate, clinical evaluation report, PMS/PMCF, vigilance history."),
        ("Commercial", "Revenue and batch sales are reported, but scale, recurrence, customer concentration, and pipeline are unknown.", "Invoices, bank evidence, customer list, cohort revenue, backlog, pipeline."),
        ("Unit economics", "No public price, gross margin, manufacturing yield, warranty reserve, or service cost is available.", "BOM, labor routing, COGS bridge, gross-margin history, service and return data."),
        ("Manufacturing", "Regulated hardware introduces supplier, quality, calibration, cleaning, and repair risks.", "Approved supplier list, capacity model, yield, incoming QC, CAPA and audit history."),
        ("IP and competition", "Artificial-tendon patents are reported, but claims and freedom-to-operate have not been assessed here.", "Patent schedule, prosecution status, FTO opinion, competitor claim chart."),
        ("Adoption", "Hospital tests and public need do not guarantee procurement, training, adherence, reimbursement, or repeat use.", "Reference calls, utilization, NPS, training time, procurement and reimbursement evidence."),
    ]
    risk_table = Table(
        [[p("RISK", "TableHead"), p("CURRENT PUBLIC VIEW", "TableHead"), p("PROOF REQUEST", "TableHead")]] +
        [[p(a, "TableCell"), p(b, "TableCell"), p(c, "TableCell")] for a, b, c in risk_rows],
        colWidths=[34 * mm, 70 * mm, 66 * mm],
        repeatRows=1,
    )
    risk_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), RED),
        ("GRID", (0, 0), (-1, -1), 0.45, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story += [risk_table, Spacer(1, 6 * mm)]
    story += [p("PROPOSED 12-MONTH DILIGENCE MILESTONES - PROOFLINE HYPOTHESES", "H2x")]
    story += [bullet("Verify primary regulatory, quality, patent, sales, and financial records before any investment decision.")]
    story += [bullet("Establish product-specific clinical and real-world evidence plan with pre-specified outcomes and adverse-event reporting.")]
    story += [bullet("Demonstrate repeatable manufacturing batches with documented yield, gross margin, service burden, and on-time delivery.")]
    story += [bullet("Show a stage-defined institutional pipeline with referenceable users, conversion data, and repeat or expansion orders.")]
    story += [bullet("Define the research-system and certified-device portfolio boundaries, pricing architecture, and channel strategy.")]
    story += [Spacer(1, 5 * mm), box(
        "Decision status",
        "POLICY-ELIGIBLE FOR HUMAN REVIEW under Proofline's frozen fixed-check demo policy. This is not APPROVED, COMMITTED, GUARANTEED, or INVESTED. No funds are reserved and no transfer is authorized.",
        GREEN_SOFT,
        GREEN,
    )]
    story += [PageBreak()]

    story += section_title("7 / Sources and demo instructions", "Traceable evidence register", "URLs are printed in full so the uploaded plan remains independently auditable outside Proofline.")
    sources = [
        ("S1", "Emovo Care", "Products and Emovo Clinic product page", "Captured 19 Jul 2026", "https://www.emovocare.com/ and https://www.emovocare.com/emovo-clinic"),
        ("S2", "Emovo Care", "About and team page", "Captured 19 Jul 2026", "https://emovocare.com/about"),
        ("S3", "Venturelab", "Emovo Care SA profile and milestone ledger", "Captured 19 Jul 2026", "https://www.venturelab.swiss/index.cfm?page=137304&profil_id=24256"),
        ("S4", "EPFL", "Exoskeleton device helps stroke victims regain hand function", "11 May 2022", "https://actu.epfl.ch/news/exoskeleton-device-helps-stroke-victims-regain-han/"),
        ("S5", "Venture Kick", "Emovo Care wins CHF 150,000", "14 May 2020", "https://www.venturekick.ch/Adiposs-Cachexia-Detection-and-Emovo-Cares-Robotic-Gloves-for-People-with-Disabilities-Each-Win-CHF-150000"),
        ("S6", "EPFL / FIT", "Beyond Scroll and Emovo Care granted from FIT", "12 Oct 2023", "https://actu.epfl.ch/news/beyond-scroll-and-emovo-care-granted-from-fit"),
        ("S7", "World Health Organization", "Rehabilitation fact sheet", "22 Apr 2024", "https://www.who.int/news-room/fact-sheets/detail/rehabilitation"),
        ("S8", "World Health Organization", "World Rehabilitation Alliance - workforce", "Captured 19 Jul 2026", "https://www.who.int/initiatives/world-rehabilitation-alliance/workforce"),
        ("S9", "NHS England", "NHS England's work on stroke", "Captured 19 Jul 2026", "https://www.england.nhs.uk/ourwork/clinical-policy/stroke/"),
        ("S10", "Osuagwu et al.", "Home-based rehabilitation using a soft robotic hand glove device", "J NeuroEng Rehabil. 2020;17:40", "https://pubmed.ncbi.nlm.nih.gov/32138780/ - DOI 10.1186/s12984-020-00660-y"),
        ("S11", "Prospective randomized study", "Individual and combined robotic and conventional hand rehabilitation", "PMID 40856375", "https://pubmed.ncbi.nlm.nih.gov/40856375/"),
    ]
    source_rows = []
    for sid, publisher, title, date, url in sources:
        source_rows.append([
            p(sid, "TableCell"),
            p(f"<b>{publisher}</b><br/>{title}<br/><font color='#5D6861'>{date}</font><br/>{url}", "Source"),
        ])
    source_table = Table(
        [[p("ID", "TableHead"), p("SOURCE", "TableHead")]] + source_rows,
        colWidths=[14 * mm, 156 * mm],
        repeatRows=1,
    )
    source_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#F1F3F0")),
    ]))
    story += [source_table, Spacer(1, 6 * mm)]
    story += [p("DEMO UPLOAD", "H2x")]
    story += [bullet("In Proofline Live research, choose Analyze a startup and upload this exact PDF.")]
    story += [bullet("Use company name 'Emovo Care' and founder names 'Luca Randazzo, Iselin Froybu'.")]
    story += [bullet("Optionally enable Exa to cross-check the current live query plan. Exa and Tavily results remain unreviewed until attested.")]
    story += [bullet("Proofline recognizes only the exact packaged file digest and then explicitly loads its separate frozen reviewed source pack. The PDF itself remains self-reported evidence.")]
    story += [Spacer(1, 6 * mm), p("EXPECTED FROZEN DEMO OUTPUT", "H2x")]
    story += [fact_table([
        ("Opportunity score", "62.1 / 100. A bounded evidence-and-coverage-adjusted assessment, not a success probability."),
        ("Evidence coverage", "85.1%. Unit economics remain explicitly missing."),
        ("Uncertainty", "+/- 18 points (medium). The displayed score band is 44.1 to 80.1."),
        ("Strongest dimension", "Product / technical fit: 69.2."),
        ("Fixed-check policy", "USD 100,000 - POLICY-ELIGIBLE FOR HUMAN REVIEW."),
        ("Capital status", "Non-binding. Not approved, committed, guaranteed, or invested; no funds are reserved."),
    ])]
    story += [Spacer(1, 4 * mm), box(
        "Final boundary",
        "A deterministic product demo is possible because the cited source snapshot and policy are frozen. A current live-web result, future company performance, return, or real investment outcome cannot be guaranteed.",
        AMBER_SOFT,
        AMBER,
    )]

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(OUTPUT)


if __name__ == "__main__":
    build()
