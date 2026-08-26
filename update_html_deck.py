import base64
import os

logo_path = r"C:\Users\laksh\.gemini\antigravity\brain\ba481067-c2ec-47d3-8538-41292137446b\ekhum_chaos_logo_1787080419968.jpg"
hero_path = r"C:\Users\laksh\.gemini\antigravity\brain\ba481067-c2ec-47d3-8538-41292137446b\childfund_hero_ui_1787080439936.jpg"
html_path = r"e:\DanaPro\EKhum_ChildFund_Pitch_Deck.html"

with open(logo_path, "rb") as f:
    logo_b64 = base64.b64encode(f.read()).decode("utf-8")

with open(hero_path, "rb") as f:
    hero_b64 = base64.b64encode(f.read()).decode("utf-8")

with open(html_path, "r", encoding="utf-8") as f:
    html = f.read()

# Update Slide 1
old_box = """        <div class="logo-hero-box">
          <div style="font-size: 11px; text-transform: uppercase; color: var(--primary); font-weight: 800; margin-bottom: 8px; letter-spacing: 0.5px;">OFFICIAL PLATFORM LOGO</div>
          <div style="font-size: 32px; font-weight: 800; color: var(--text-title); margin-bottom: 4px;">EKhum</div>
          <div style="font-size: 13px; font-weight: 700; color: var(--text-muted); margin-bottom: 20px; letter-spacing: 1px;">CHAOS DESIGN</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%;">
            <div style="background: var(--bg-subtle); padding: 14px; border-radius: 12px; border: 1px solid var(--border);">
              <div style="color: var(--primary); font-weight: 800; font-size: 20px;">0.0%</div>
              <div style="color: var(--text-muted); font-size: 12px; font-weight: 600;">Platform Fee</div>
            </div>
            <div style="background: var(--bg-subtle); padding: 14px; border-radius: 12px; border: 1px solid var(--border);">
              <div style="color: var(--primary); font-weight: 800; font-size: 20px;">4 Gateways</div>
              <div style="color: var(--text-muted); font-size: 12px; font-weight: 600;">Auto-Failover</div>
            </div>
          </div>
        </div>"""

new_box = f"""        <div class="logo-hero-box" style="padding: 16px;">
          <img src="data:image/jpeg;base64,{logo_b64}" alt="EKhum by CHAOS Official Logo" style="width: 100%; max-height: 240px; object-fit: contain; border-radius: 12px; margin-bottom: 16px;" />
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; width: 100%;">
            <div style="background: var(--bg-subtle); padding: 12px; border-radius: 12px; border: 1px solid var(--border); text-align: center;">
              <div style="color: var(--primary); font-weight: 800; font-size: 22px;">0.0%</div>
              <div style="color: var(--text-muted); font-size: 12px; font-weight: 600;">Platform Fee</div>
            </div>
            <div style="background: var(--bg-subtle); padding: 12px; border-radius: 12px; border: 1px solid var(--border); text-align: center;">
              <div style="color: var(--primary); font-weight: 800; font-size: 22px;">4 Gateways</div>
              <div style="color: var(--text-muted); font-size: 12px; font-weight: 600;">Smart Routing</div>
            </div>
          </div>
        </div>"""

if old_box in html:
    html = html.replace(old_box, new_box)
    print("Replaced old logo box in Slide 1")
else:
    print("Could not find exact old_box in Slide 1")

# Update Slide 4
old_slide4 = """    <!-- SLIDE 4: The Solution (Light Mode) -->
    <div class="slide-container" id="slide-4">
      <div class="slide-category">The Solution</div>
      <h2 class="slide-heading">EKhum by CHAOS: Purpose-Built for Indian Giving</h2>
      <p class="slide-subheading">An integrated, cloud-native fundraising operating system with zero platform commissions.</p>
      
      <div class="grid-2">
        <div class="card card-accent">
          <div class="card-tag">💳 4-Way Gateway Hub</div>
          <h3 class="card-title">Multi-Gateway Smart Routing</h3>
          <p class="card-desc">Razorpay, PayU, CCAvenue & Worldline routing with auto-fallback and unified reconciliation.</p>
        </div>
        <div class="card card-accent">
          <div class="card-tag">🤖 Visual Flow Canvas</div>
          <h3 class="card-title">Visual Journey Builder</h3>
          <p class="card-desc">Drag-and-drop workflow canvas for multi-step WhatsApp and Email donor journeys.</p>
        </div>
        <div class="card card-accent">
          <div class="card-tag">⚡ Event-Driven Engine</div>
          <h3 class="card-title">Real-Time Event Bus</h3>
          <p class="card-desc">11 instant trigger events connecting donor actions to automated lifecycle responses.</p>
        </div>
        <div class="card card-accent">
          <div class="card-tag">📜 Automated Compliance</div>
          <h3 class="card-title">80G & Form 10BD Engine</h3>
          <p class="card-desc">Instant statutory receipts with QR verification snapshot and Income Tax Form 10BD export.</p>
        </div>
      </div>
    </div>"""

new_slide4 = f"""    <!-- SLIDE 4: The Solution (Light Mode) -->
    <div class="slide-container" id="slide-4">
      <div class="slide-category">The Solution</div>
      <h2 class="slide-heading">EKhum by CHAOS: Purpose-Built for Indian Giving</h2>
      <p class="slide-subheading">An integrated, cloud-native fundraising operating system with zero platform commissions.</p>
      
      <div style="display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 24px; flex: 1; align-items: stretch;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
          <div class="card card-accent" style="padding: 14px;">
            <div class="card-tag">💳 Gateway Hub</div>
            <h3 class="card-title" style="font-size: 15px; margin-bottom: 4px;">4-Way Routing</h3>
            <p class="card-desc" style="font-size: 12px; line-height: 1.4;">Razorpay, PayU, CCAvenue & Worldline routing with auto-fallback.</p>
          </div>
          <div class="card card-accent" style="padding: 14px;">
            <div class="card-tag">🤖 Journey Canvas</div>
            <h3 class="card-title" style="font-size: 15px; margin-bottom: 4px;">Visual Automations</h3>
            <p class="card-desc" style="font-size: 12px; line-height: 1.4;">Drag-and-drop builder for multi-step WhatsApp & Email donor journeys.</p>
          </div>
          <div class="card card-accent" style="padding: 14px;">
            <div class="card-tag">⚡ Event Engine</div>
            <h3 class="card-title" style="font-size: 15px; margin-bottom: 4px;">Real-Time Event Bus</h3>
            <p class="card-desc" style="font-size: 12px; line-height: 1.4;">11 instant trigger events connecting donor actions to automated responses.</p>
          </div>
          <div class="card card-accent" style="padding: 14px;">
            <div class="card-tag">📜 Compliance</div>
            <h3 class="card-title" style="font-size: 15px; margin-bottom: 4px;">80G & Form 10BD</h3>
            <p class="card-desc" style="font-size: 12px; line-height: 1.4;">Instant statutory receipts with QR verification and Form 10BD export.</p>
          </div>
        </div>
        <div style="background: #FFFFFF; border: 1.5px solid var(--border); border-radius: 16px; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
          <img src="data:image/jpeg;base64,{hero_b64}" alt="ChildFund Sponsor Portal UI Mockup" style="width: 100%; height: 100%; object-fit: cover;" />
        </div>
      </div>
    </div>"""

if old_slide4 in html:
    html = html.replace(old_slide4, new_slide4)
    print("Replaced Slide 4 with hero UI mockup")
else:
    print("Could not find exact old_slide4 in HTML")

with open(html_path, "w", encoding="utf-8") as f:
    f.write(html)

print("SUCCESS: Updated EKhum_ChildFund_Pitch_Deck.html with embedded visual assets")
