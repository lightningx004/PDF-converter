from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.units import inch


def generate_vtu_predicted_paper():

    filename = "VTU_BEEE_Predicted_QP.pdf"

    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        topMargin=0.5 * inch,
        bottomMargin=0.5 * inch
    )

    elements = []
    styles = getSampleStyleSheet()

    # =========================
    # HEADER
    # =========================
    header_style = ParagraphStyle(
        'Header',
        parent=styles['Heading1'],
        alignment=1,
        fontSize=14,
        spaceAfter=5
    )

    sub_header_style = ParagraphStyle(
        'SubHeader',
        parent=styles['Normal'],
        alignment=1,
        fontSize=11,
        spaceAfter=20
    )

    elements.append(Paragraph(
        "VISVESVARAYA TECHNOLOGICAL UNIVERSITY, BELAGAVI",
        header_style))

    elements.append(Paragraph(
        "First/Second Semester B.E./B.Tech. Degree Examination",
        sub_header_style))

    # =========================
    # DETAILS TABLE
    # =========================
    data = [
        ["Subject: Introduction to Electrical Engineering", "Subject Code: 1BESC104B/204B"],
        ["Time: 3 Hours", "Max. Marks: 100"]
    ]

    t = Table(data, colWidths=[4 * inch, 2.5 * inch])
    t.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, 1), 'LEFT'),
        ('ALIGN', (1, 0), (1, 1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
    ]))

    elements.append(t)
    elements.append(Spacer(1, 0.2 * inch))

    elements.append(Paragraph(
        "<b>Note:</b> Answer any FIVE full questions, choosing ONE full question from each module.",
        styles['Normal']))

    elements.append(Spacer(1, 0.3 * inch))

    # =========================
    # QUESTION STYLE
    # =========================
    q_style = ParagraphStyle(
        'Question',
        parent=styles['Normal'],
        fontSize=11,
        leading=14,
        spaceAfter=5
    )

    # =========================
    # QUESTIONS (YOUR ORIGINAL CONTENT – UNCHANGED)
    # =========================
    q_pairs = [
        ("Module - 1",
         [("a) State KCL and KVL. Explain the sign convention with an example.", "6"),
          ("b) Use Mesh Analysis to find current in the 10Ω resistor for the given network (Assume standard bridge).", "7"),
          ("c) Derive the expressions for Star to Delta transformation.", "7")],
         [("a) State Ohm's Law. What are its limitations?", "6"),
          ("b) Determine the voltage V1 and V2 using Nodal Analysis.", "7"),
          ("c) Two resistors are connected in parallel and this combination is in series with a 5Ω resistor. If total voltage is 50V, find power dissipated.", "7")]
         ),

        ("Module - 2",
         [("a) Derive the expression for RMS and Average value of a sinusoidal wave.", "6"),
          ("b) A series RLC circuit has R=10Ω, L=0.1H, C=50μF. Supply is 200V, 50Hz. Find Current and Power Factor.", "7"),
          ("c) Draw and explain the Power Triangle. Define Active, Reactive, and Apparent power.", "7")],
         [("a) Explain the behavior of AC through a pure Inductor with waveforms and phasor diagram.", "6"),
          ("b) Two circuits with impedances Z1=(8+j6) and Z2=(10-j5) are in parallel. Find total current.", "7"),
          ("c) What is resonance? Derive the expression for resonant frequency in a series RLC circuit.", "7")]
         ),

        ("Module - 3",
         [("a) In a 3-Phase Star connection, prove that Line Voltage = √3 * Phase Voltage.", "7"),
          ("b) With a circuit diagram and phasor diagram, explain the Two Wattmeter method.", "7"),
          ("c) A balanced delta connected load draws 10A line current at 0.8 pf lag. Calculate total power.", "6")],
         [("a) In a 3-Phase Delta connection, prove that Line Current = √3 * Phase Current.", "7"),
          ("b) Explain Plate Earthing with a neat diagram.", "7"),
          ("c) Explain the effect of Load Power Factor on Wattmeter readings (Unity, 0.5, Zero).", "6")]
         ),

        ("Module - 4",
         [("a) Draw a neat diagram of a DC Machine and label the parts. Explain the function of the Commutator.", "7"),
          ("b) Derive the EMF equation of a transformer.", "6"),
          ("c) A 4-pole DC motor takes 20A at 200V. Resistance is 0.5Ω. Find Back EMF.", "7")],
         [("a) Explain the Open Circuit (OC) and Short Circuit (SC) tests on a transformer.", "7"),
          ("b) Derive the Torque equation of a DC Motor.", "6"),
          ("c) A 10kVA transformer with turn ratio 500/1000 is connected to 200V supply. Find secondary voltage and full load currents.", "7")]
         ),

        ("Module - 5",
         [("a) Explain the construction and working of a 3-Phase Induction Motor.", "7"),
          ("b) Derive the EMF equation of an Alternator (Synchronous Generator).", "7"),
          ("c) A 3-phase induction motor has 4 poles and runs on 50Hz. Calculate synchronous speed.", "6")],
         [("a) Explain the concept of Slip in Induction Motors. Why can slip never be zero?", "6"),
          ("b) Explain the working of a Dynamo/DC Generator briefly.", "7"),
          ("c) Write a note on domestic wiring safety: Use of Fuse vs MCB.", "7")]
         )
    ]

    # =========================
    # RENDER LOOP
    # =========================
    q_count = 1

    for mod_name, q_a, q_b in q_pairs:

        elements.append(Paragraph(f"<b>{mod_name}</b>", styles['Heading3']))
        elements.append(Spacer(1, 0.1 * inch))

        for question_set in [q_a, q_b]:

            elements.append(Paragraph(f"<b>{q_count}.</b>", styles['Normal']))

            table_data = []
            for txt, mark in question_set:
                table_data.append([
                    Paragraph(txt, q_style),
                    Paragraph(f"{mark} M", q_style)
                ])

            table = Table(table_data, colWidths=[6 * inch, 0.8 * inch])
            table.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('ALIGN', (1, 0), (1, -1), 'RIGHT')
            ]))

            elements.append(table)

            if question_set == q_a:
                elements.append(Paragraph("<b>OR</b>",
                                          ParagraphStyle('Center',
                                                         alignment=1,
                                                         spaceBefore=4,
                                                         spaceAfter=4)))

            q_count += 1

        elements.append(Spacer(1, 0.25 * inch))

    # =========================
    # BUILD PDF
    # =========================
    doc.build(elements)

    print("PDF Generated:", filename)


if __name__ == "__main__":
    generate_vtu_predicted_paper()
