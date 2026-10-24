# Ember Signal × Luma Foundry Integration Assessment

**စစ်ဆေးသည့်နေ့:** 2026-09-22  
**အခြေအနေ:** Technical deployment verified; Luma-to-Render live data bridge and automation scenario are not active.

## အနှစ်ချုပ်ဆုံးဖြတ်ချက်

Ember Signal သည် လက်ရှိတွင် လမ်းကြောင်းနှစ်ခုအဖြစ် သီးခြားအလုပ်လုပ်နေပါသည်။ `lumafoundry.live/ember-signal` သည် Luma Foundry application ၏ native Ember page ဖြစ်ပြီး Luma server ၏ local evidence file ကို ဖတ်ပါသည်။ `ember-signal-web.onrender.com` သည် GitHub repository မှ သီးခြားတင်ထားသော Flask web service ဖြစ်ပြီး ၎င်း၏ local SQLite database နှင့် evidence JSON ကို ဖတ်ပါသည်။ ထို့ကြောင့် Render deployment live ဖြစ်သွားခြင်းသည် Luma public page ကို Render data source အဖြစ် အလိုအလျောက် မပြောင်းပေးပါ။

လက်ရှိ verified state မှာ public health နှင့် signals endpoint နှစ်ခုစလုံး အလုပ်လုပ်နေသော်လည်း၊ **Luma → Render direct bridge, Drive → Luma database sync, Make scenario, နှင့် approved Ember product record** မရှိသေးပါ။ ထို့အပြင် endpoint နှစ်ခု၏ response shape မတူသောကြောင့် တိုက်ရိုက် proxy မလုပ်မီ canonical contract တစ်ခု သတ်မှတ်ရပါမည်။

## 1. လက်ရှိ public/runtime ချိတ်ဆက်မှု

| အစိတ်အပိုင်း | လက်ရှိ source | Verified result | အဓိပ္ပါယ် |
|---|---|---|---|
| `https://lumafoundry.live/ember-signal` | Luma Foundry server/client | HTTP 200 | Luma-hosted Ember page ဖြစ်သည် |
| `https://lumafoundry.live/api/signals` | Luma local file adapter | HTTP 200 | `data/ember-signal-evidence.json` ကို ဖတ်သည် |
| `https://ember-signal-web.onrender.com/api/health` | Render Flask service | HTTP 200, `{"status":"ok"}` | Render deployment health သာ စစ်သည် |
| `https://ember-signal-web.onrender.com/api/signals` | Render Flask service | HTTP 200 | Render-side SQLite + evidence JSON ကို ဖတ်သည် |
| Make automation | Make workspaces | Scenario မတွေ့ | Automation trigger/action မဖွင့်ထားသေး |

Luma public page သည် Render URL ကို frontend data source အဖြစ် မခေါ်ပါ။ Luma server ၏ public route သည် evidence ဖတ်ပြီး `status`, `source`, `updatedAt`, `top_brands`, `evidence` ကို ပြန်ပေးပါသည်။ လက်ရှိ Luma payload တွင် `top_brands` သည် empty ဖြစ်ပြီး `My First Evidence` တစ်ခု ပါဝင်သည်။

Render payload တွင် `My First Evidence` တစ်ခု ပါဝင်သကဲ့သို့ `Apple`, `Microsoft`, `NVIDIA` ဟူသော brand rows သုံးခုလည်း ပါဝင်သည်။ သို့သော် အဲဒီ record နှစ်ခုသည် တစ်ခုနှင့်တစ်ခု sync ဖြစ်ကြောင်း သက်သေမဟုတ်ပါ။ တူညီသော fixture/data ကို နေရာနှစ်ခုတွင် သီးခြားသိမ်းထားခြင်း ဖြစ်နိုင်ပါသည်။ ထို့ကြောင့် record count ကို ပေါင်း၍ နှစ်ဆမတွက်ရပါ။

## 2. Luma Foundry ထဲက Ember page ဘယ်လိုအလုပ်လုပ်သလဲ

Luma application ထဲတွင် Ember route ကို `/ember-signal` အဖြစ် register လုပ်ထားပါသည်။ Brief builder သည် protected tRPC procedure နှစ်ခုကို အသုံးပြုပါသည်။ `getLocalEvidence` သည် Luma server ၏ local evidence reader ကို ခေါ်ပြီး `buildCampaignBrief` သည် Luma ၏ built-in LLM invocation layer ကို အသုံးပြုပါသည်။ ထို brief builder သည် လက်ရှိ Render API၊ Anthropic၊ OpenRouter၊ သို့မဟုတ် Z.ai endpoint ကို frontend မှ တိုက်ရိုက်မခေါ်ပါ။

Luma evidence reader သည် default path အဖြစ် `data/ember-signal-evidence.json` ကို အသုံးပြုပါသည်။ `EMBER_SIGNAL_EVIDENCE_FILE` environment variable ရှိလျှင် ထို path ကို override လုပ်နိုင်ပါသည်။ Reader တွင် JSON schema validation၊ 2 MB size limit နှင့် credential-like text rejection ပါရှိသည်။ ထို safety boundary သည် ဆက်လက်ထားရှိသင့်ပါသည်။

## 3. Render service နှင့် Luma ကြား data gap

Render deployment သည် အောက်ပါ identity ဖြင့် live ဖြစ်နေပါသည်။

| Field | Verified value |
|---|---|
| Service | `ember-signal-web` |
| Service ID | `srv-dap9srff3r2c73ehf7g0` |
| Deploy ID | `dep-dap9srnf3r2c73ehf8a0` |
| Repository | `highfive251677-wq/ember-signal` |
| Branch | `fix/dedicated-health-endpoint` |
| Commit | `cf83370ea46c4fb795aeebfefb90df2acc5d8649` |
| Public URL | `https://ember-signal-web.onrender.com` |
| Health path | `/api/health` |
| Start command | `gunicorn --bind 0.0.0.0:$PORT app:app` |
| Plan | Free |

Render `GET /api/health` သည် DB သို့မဟုတ် external API မခေါ်ဘဲ plain health result ပြန်ပါသည်။ Render `GET /api/signals` သည် data/business logic ကို ဖတ်သော endpoint ဖြစ်သောကြောင့် Render health check အဖြစ် မသုံးထားခြင်း မှန်ကန်ပါသည်။

သို့သော် Luma application ၏ database model သည် Render deployment identity ကို သိမ်းရန် သီးခြား field မရှိသေးပါ။ `collaborationProducts` table တွင် `goalId`, `name`, `category`, `route`, နှင့် `status` သာ ရှိပါသည်။ Service ID, deploy ID, commit SHA, health URL, data source, နှင့် last verification timestamp အတွက် deployment mapping table သီးခြားလိုအပ်ပါသည်။

## 4. Google Drive / Operator Sync အခြေအနေ

Authoritative Operator Sync workbook သည် `Goals`, `Products`, `Tasks`, `Handoffs`, `Decisions`, နှင့် `Sync Log` tabs ပါရှိသော workbook ဖြစ်ပါသည်။ IP Compliance Register သည် သီးခြား workbook ဖြစ်ပြီး `IP Compliance Status`, `Product Evidence Matrix`, `Source Commit Register`, `Asset Licence Register`, နှင့် `Easy Task Register` tabs ပါရှိပါသည်။ Workbook နှစ်ခုကို မရောထွေးရပါ။

Operator B ၏ latest handoff `handoff-0003` သည် Render service identity, public URL, deploy ID, commit SHA, health result, signals result, နှင့် old suspended static site boundary ကို မှတ်တမ်းတင်ထားပါသည်။ `sync-0034` သည် ထို technical verification ကို read-back အဖြစ် ထပ်မံမှတ်တမ်းတင်ထားပါသည်။

သို့သော် `Products` နှင့် `Product Evidence Matrix` တို့တွင် **Ember Signal အတွက် approved product row မရှိသေးပါ**။ ထို့ကြောင့် Operator B က product row ကို ခန့်မှန်းပြီး မဖန်တီးထားခြင်း မှန်ကန်ပါသည်။ Render handoff ရှိနေခြင်းသည် Luma catalogue product identity ရှိနေပြီဟု မဆိုလိုပါ။

## 5. Luma database အခြေအနေ

Luma collaboration database ကို read-only စစ်ဆေးရာတွင် လက်ရှိ record များမှာ—

- Goal တစ်ခု: `Launch Batch 01 on the Luma Foundry storefront`
- Product ငါးခု: Axiom Grid, Selene Agents, Kinetic Mesh, Lattice Labs, Orbital Ledger
- Ember Signal product record: **မရှိသေး**
- Collaboration handoff rows: database ထဲတွင် မရှိသေး
- Collaboration work-item rows: database ထဲတွင် မရှိသေး

Google Sheet တွင် Ember handoff/sync records ရှိသော်လည်း Luma database တွင် မရှိသေးခြင်းက **Drive coordination record နှင့် product workspace database သည် လက်ရှိ authoritative stores နှစ်ခုအဖြစ် ခွဲနေခြင်း** ကို ပြပါသည်။ ဤအဆင့်တွင် record နှစ်ခုကို အလိုအလျောက် နှစ်ဖက် sync မလုပ်သင့်သေးပါ။

## 6. အကြံပြုထားသော integration architecture

အန္တရာယ်နည်းပြီး စစ်ဆေးရလွယ်သော ပုံစံမှာ **one-way, read-only Render-to-Luma evidence bridge** ဖြစ်ပါသည်။ Render ကို operational data source အဖြစ် သတ်မှတ်ပြီး Luma public page က server-side fetch ဖြင့် Render endpoint ကို ဖတ်ပါမည်။ Browser မှ Render API ကို တိုက်ရိုက်မခေါ်သင့်ပါ။ ထိုသို့လုပ်လျှင် API details, failure handling, နှင့် source control ပျံ့နှံ့နိုင်ပါသည်။

အဆင့်များမှာ အောက်ပါအတိုင်း ဖြစ်သင့်ပါသည်။

1. Operator B သည် `prd-ember-signal` ကဲ့သို့ product ID တစ်ခုကို approve လုပ်ရမည်။ Product ID ကို owner approval မရှိဘဲ မသတ်မှတ်ရပါ။
2. Approved product row ကို Operator Sync ၏ `Products` tab နှင့် Luma database ၏ `collaborationProducts` table နှစ်ခုတွင် mapping တူညီစွာ ထည့်ရမည်။
3. Product row ရှိပြီးနောက် Render service identity ကို `product_deployments` သို့မဟုတ် အလားတူ သီးခြား mapping table တွင် ထည့်ရမည်။ Product row ၏ `route` field ထဲတွင် service ID, deploy ID, နှင့် commit ကို စုပြီးမထည့်သင့်ပါ။
4. Luma server သည် Render `/api/signals` ကို timeout, schema validation, source label, နှင့် stale-data handling ဖြင့်ဖတ်ရမည်။
5. Render response ကို Luma canonical schema အဖြစ် normalize လုပ်ရမည်။ လက်ရှိ Render ၏ tuple brand rows နှင့် Luma ၏ object brand rows မတူသောကြောင့် adapter လိုအပ်သည်။
6. Luma UI တွင် `source = render`, `verifiedAt`, `releaseCommit`, နှင့် evidence status ကို သီးခြားပြသရမည်။ Local fallback ကို အသုံးပြုလျှင် fallback ဖြစ်ကြောင်း မဖုံးကွယ်ဘဲ ပြရမည်။
7. ပထမဆုံး release တွင် Render-to-Luma data flow ကို read-only ထားရမည်။ Luma မှ Render database သို့ write-back မလုပ်သင့်သေးပါ။
8. Render health check သည် `/api/health` ကိုသာ ဆက်သုံးရမည်။ Data endpoint ကို liveness signal အဖြစ် မပြောင်းရပါ။

## 7. Automation workflow ကို ဘယ်လိုချိတ်မလဲ

Make workspaces နှစ်ခုစလုံးတွင် scenario မတွေ့သောကြောင့် exact scenario ID မရှိသေးပါ။ ထို့ကြောင့် လက်ရှိ workflow သည် Render API read-only verification နှင့် Drive manual handoff အဆင့်တွင်သာ ရှိပါသည်။ Scenario ID မရှိဘဲ Make action ကို ခန့်မှန်း၍ activate မလုပ်ရပါ။

စတင်ချိတ်မည့် ပထမဆုံး workflow သည် အောက်ပါ bounded flow ဖြစ်သင့်ပါသည်။

```text
Manual trigger
  → Render service/deploy read
  → /api/health check
  → /api/signals fetch
  → schema and secret scan
  → commit/deploy/service identity comparison
  → Drive handoff draft
  → Operator B review
```

ထို flow အောင်မြင်ပြီးမှသာ event-trigger သို့မဟုတ် recurring schedule စဉ်းစားသင့်ပါသည်။ Render webhook သုံးမည်ဆိုလျှင် HTTPS receiver, signature verification, replay protection, idempotency, retry policy, နှင့် Pro-or-higher workspace requirement ကို အရင်ဖြည့်ရမည်။

## 8. Operator B လိုအပ်သည့် အချက်များ

Operator B ဘက်က အောက်ပါအချက်များကို ဆုံးဖြတ်ပေးရန်လိုပါသည်။

### Product identity

Ember Signal သည် Luma Foundry catalogue product အဖြစ် ထည့်မည်လား၊ သီးခြား pilot service အဖြစ်သာထားမည်လား ဆုံးဖြတ်ရမည်။ Catalogue product အဖြစ် ထည့်မည်ဆိုလျှင် approved product ID, goal ID, category, public route, source state, နှင့် owner ကို သတ်မှတ်ရမည်။

### Source-of-truth decision

Render evidence ကို canonical source လုပ်မည်လား၊ Luma local evidence ကို canonical source လုပ်မည်လား ဆုံးဖြတ်ရမည်။ နှစ်ခုစလုံးကို တစ်ပြိုင်နက် authority အဖြစ် မထားသင့်ပါ။ အကြံပြုချက်မှာ Render operational service ကို source လုပ်ပြီး Luma ကို read-only presentation layer အဖြစ်ထားခြင်း ဖြစ်သည်။

### Evidence and commercial boundary

Render service ID, deploy ID, commit SHA, health result, နှင့် signals result သည် technical runtime evidence ဖြစ်သည်။ ၎င်းတို့သည် source ownership, design history, asset licence, contributor rights, dependency licence, သို့မဟုတ် counsel review ကို အစားမထိုးနိုင်ပါ။ Ember-lite pilot သည် `READY FOR JOINT REVIEW` အဖြစ်သာ ဆက်ရှိပြီး commercial clearance မရသေးပါ။

### Register mapping

Operator B သည် approved product row မရမချင်း `Product Evidence Matrix` ထဲတွင် Ember Signal row အသစ် မဖန်တီးသင့်ပါ။ Product ID approve ပြီးပါက Render handoff ကို အဲဒီ ID နှင့် link လုပ်ပြီး Source Commit Register, evidence matrix, Handoffs, နှင့် Sync Log တို့တွင် same release identity သုံးရမည်။

### Automation target

Make scenario မရှိသေးသောကြောင့် owner သည် target workspace နှင့် scenario ကို တိတိကျကျ ရွေးပေးရမည်။ Scenario ဖန်တီးပြီးပါက scenario ID, trigger, action modules, destination Drive folder/tab, retry policy, idempotency key, နှင့် failure notification ကို Operator B က မှတ်တမ်းတင်ရမည်။

## 9. အခုချိန်တွင် မလုပ်သင့်သေးသောအရာများ

- Product ID မရှိဘဲ Ember row ဖန်တီးခြင်း
- Luma နှင့် Render evidence ကို count ပေါင်းခြင်း
- Render `/api/signals` ကို health check အဖြစ် သုံးခြင်း
- Make scenario ID မရှိဘဲ automation activate လုပ်ခြင်း
- Luma database ကို Render data ဖြင့် write-back sync လုပ်ခြင်း
- Technical deployment ကို commercial clearance အဖြစ် ပြောင်းခြင်း
- Ember-lite patch ကို joint review မပြီးမီ merge/deploy လုပ်ခြင်း
- Payment, checkout, fulfilment, webhook, သို့မဟုတ် public commercial activation ဖွင့်ခြင်း

## 10. နောက်တစ်ဆင့်အတွက် အကောင်းဆုံး လုပ်ဆောင်ချက်

အနည်းဆုံး အလုပ်စဉ်မှာ **အဆင့်တစ်ခုတည်း** ဖြင့် စသင့်ပါသည်။ Owner သည် Ember Signal ကို Luma product အဖြစ် register မည်ဟု အတည်ပြုပြီး product ID နှင့် goal mapping ကို ပေးရမည်။ ထိုအချက်ရပြီးမှ Operator A က database mapping schema နှင့် read-only Render adapter ကို dedicated branch တွင် ပြင်ဆင်နိုင်ပါသည်။ Operator B က ထို branch ၏ release identity နှင့် Drive register mapping ကို review လုပ်နိုင်ပါသည်။

ဒီအဆင့်ပြီးမှသာ Make scenario သို့မဟုတ် recurring automation ကို ထည့်သင့်ပါသည်။ ယခုအချိန်တွင် **technical runtime = verified, Luma presentation = verified, cross-system bridge = not active, product mapping = pending, automation scenario = absent, commercial clearance = unchanged** ဟု သတ်မှတ်ရပါမည်။

## References

[1]: https://lumafoundry.live/ "Luma Foundry public storefront"
[2]: https://lumafoundry.live/ember-signal "Luma Foundry Ember Signal route"
[3]: https://lumafoundry.live/api/signals "Luma Ember Signal public evidence API"
[4]: https://ember-signal-web.onrender.com/api/health "Ember Signal Render health endpoint"
[5]: https://ember-signal-web.onrender.com/api/signals "Ember Signal Render signals endpoint"
[6]: https://docs.google.com/spreadsheets/d/1mM6HtzS14FRygndjIDYfzl8LGxF7jq0-ISfpniijaTU/edit "Luma Foundry Operator Sync workbook"
[7]: https://docs.google.com/spreadsheets/d/1lAGdfAjOfR618fBV7myEvv8a30o8nLb5jknSM8ndroU/edit "Luma Foundry IP Compliance Register"
[8]: https://github.com/highfive251677-wq/ember-signal/pull/1 "Ember Signal dedicated health endpoint pull request"
