"""Regenerate public-safe PDFs locally after exporting the content bank."""
import sys,json,re,html,hashlib
from pathlib import Path
sys.path.insert(0,'D:/Resume/tmp/python_packages')
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,PageBreak,Preformatted,KeepTogether
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import pymupdf
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'dist/pdfs';OUT.mkdir(exist_ok=True)
data=json.loads((ROOT/'dist/data.js').read_text(encoding='utf-8').removeprefix('window.PREP_DATA = ').rstrip(';\n'))
for name,filename in [('Prep','arial.ttf'),('PrepBold','arialbd.ttf'),('PrepCode','consola.ttf')]:pdfmetrics.registerFont(TTFont(name,'C:/Windows/Fonts/'+filename))
pdfmetrics.registerFontFamily('Prep',normal='Prep',bold='PrepBold',italic='Prep',boldItalic='PrepBold')
body=ParagraphStyle('Body',fontName='Prep',fontSize=10,leading=14.2,spaceAfter=8,allowWidows=0,allowOrphans=0,textColor=colors.HexColor('#20372e'))
question=ParagraphStyle('Question',parent=body,fontName='PrepBold',fontSize=13,leading=17,spaceBefore=15,spaceAfter=9,keepWithNext=True)
section=ParagraphStyle('Section',parent=question,fontSize=17,leading=21,textColor=colors.HexColor('#316c57'))
small=ParagraphStyle('Small',parent=body,fontSize=8.5,leading=12,textColor=colors.HexColor('#62756a'))
cover=ParagraphStyle('Cover',parent=question,fontSize=30,leading=36,spaceAfter=22)
code=ParagraphStyle('Code',fontName='PrepCode',fontSize=8,leading=10.5,backColor=colors.HexColor('#edf4ee'),spaceAfter=12,borderPadding=8)
esc=lambda s:html.escape(str(s),quote=False)
def bg(canvas,doc):
 canvas.saveState();canvas.setFillColor(colors.HexColor('#316c57'));canvas.rect(0,A4[1]-5,A4[0],5,fill=1,stroke=0)
 canvas.setFont('Prep',8);canvas.setFillColor(colors.HexColor('#62756a'));canvas.drawString(46,27,'PREPATOZ | PUBLIC STUDY GUIDE | 25 NOV 2026');canvas.drawRightString(A4[0]-46,27,str(doc.page));canvas.restoreState()
report=[]
for t in data['topics']:
 story=[Spacer(1,72),Paragraph('PREPATOZ / LEARN AND PRACTICE',small),Paragraph(esc(t['title']),cover),Paragraph(esc(t['description']),body),Spacer(1,15),Paragraph(f"{len(t['questions'])} questions | {sum(len(q['followups']) for q in t['questions'])} answered follow-ups",question),Paragraph('This public guide contains general concepts and permitted project questions. Protected project material is available only through the administrator workspace.',small),PageBreak()]
 current=None
 for q in t['questions']:
  if q['section']!=current:current=q['section'];story.append(Paragraph(esc(current),section))
  story.append(Paragraph(esc(q['title']),question))
  for b in q['blocks']:
   if b['label']=='Code':story.append(KeepTogether([Preformatted(b['text'],code)]))
   else:story.append(Paragraph('<b>'+esc({'Simple':'In plain language','Technical':'Technical answer','Metrics':'Evaluation metrics','Trade-offs':'Production trade-offs','Say':'Spoken answer'}.get(b['label'],b['label']))+':</b> '+esc(b['text']),body))
  for f in q['followups']:story.append(Paragraph('<b>Follow-up: '+esc(f['question'])+'</b><br/>'+esc(f['answer']),body))
 story.extend([PageBreak(),Paragraph('Primary references',section)])
 for source in t['sources']:story.append(Paragraph(esc(source['title'])+'<br/><link href="'+html.escape(source['url'],quote=True)+'">'+esc(source['url'])+'</link>',small))
 path=OUT/t['pdf'];SimpleDocTemplate(str(path),pagesize=A4,leftMargin=46,rightMargin=46,topMargin=45,bottomMargin=47,title='PrepAtoZ - '+t['title'],author='PrepAtoZ').build(story,onFirstPage=bg,onLaterPages=bg)
 pdf=pymupdf.open(path);text=''.join(p.get_text() for p in pdf)
 assert not re.search(r'sql\s*copilot|memorae?',text,re.I),t['id']
 for q in t['questions']:assert re.sub(r'\s+','',q['title']) in re.sub(r'\s+','',text),q['title']
 for page in pdf:
  for block in page.get_text('dict')['blocks']:
   for line in block.get('lines',[]):
    for span in line['spans']:
     x0,y0,x1,y1=span['bbox'];assert x0>=40 and x1<=A4[0]-40 and y0>=12 and y1<=A4[1]-15,(t['id'],page.number,span['text'])
 report.append({'id':t['id'],'pages':len(pdf),'file':path.name});pdf.close()
for file in OUT.glob('*.pdf'):
 if file.name.startswith('public-'):continue
 preserved=ROOT/'private/pdfs'/file.name
 assert preserved.exists() and hashlib.sha256(preserved.read_bytes()).digest()==hashlib.sha256(file.read_bytes()).digest(),'Original PDF was not preserved: '+file.name
 file.unlink()
(ROOT/'tools/public-pdf-manifest.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({'publicGuides':len(report),'pages':sum(r['pages'] for r in report),'protectedStaticPDFsRemoved':True}))
