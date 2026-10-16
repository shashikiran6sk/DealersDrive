from pathlib import Path
import hashlib
import json
import fontTools
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

root = Path(__file__).resolve().parents[1]
source = root / 'src/assets/fonts/Manrope-Variable.ttf'
output = root / 'src/assets/Manrope.ttf'
font = TTFont(source, recalcTimestamp=False)
instance = instantiateVariableFont(font, {'wght': 400}, updateFontNames=True)
instance.recalcTimestamp = False
instance.save(output)
assert 'fvar' not in instance
assert instance['OS/2'].usWeightClass == 400
assert instance.getBestCmap() == font.getBestCmap()
metadata = {
    'source': 'fonts/Manrope-Variable.ttf',
    'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'generated': 'Manrope.ttf',
    'generated_sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
    'tool': f'fontTools {fontTools.__version__}',
    'weight': 400,
    'license': 'OFL.txt',
    'reason': 'The variable master defaults to weight 200; native normal body text needs a real regular face.',
    'documentation': 'https://fonttools.readthedocs.io/en/latest/varLib/instancer.html',
}
(root / 'src/assets/fonts/provenance.json').write_text(json.dumps(metadata, indent=2) + '\n')
print(json.dumps(metadata))
