/**
 * Brands that no longer sell new cars in India, plus the niche and commercial
 * marques.
 *
 * Every one of these is still traded daily. Ford left in 2021 and Chevrolet in
 * 2017, which means a 2019 EcoSport and a 2016 Beat are both ordinary used-car
 * listings — and a dealer who cannot find "Ford" in the make dropdown will type
 * the model into the description instead, which is precisely the free-text
 * failure the taxonomy exists to prevent (ARCHITECTURE §6.2).
 */
import { m, make, p, type CatalogMake } from './schema.js';

export const DEPARTED: CatalogMake[] = [
  make('ford', 'Ford', 52, [
    m('figo', 'Figo', 'HATCHBACK', 2010, 2021, [
      p('PETROL', 'MANUAL', 1194, 5, ['Ambiente', 'Trend', 'Titanium', 'Titanium+', 'Sports']),
      p('PETROL', 'AUTOMATIC', 1499, 5, ['Titanium AT', 'Titanium+ AT']),
      p('DIESEL', 'MANUAL', 1498, 5, [
        'Ambiente Diesel',
        'Trend Diesel',
        'Titanium Diesel',
        'Titanium+ Diesel',
      ]),
      p('DIESEL', 'MANUAL', 1399, 5, [
        'LXI Duratorq',
        'EXI Duratorq',
        'ZXI Duratorq',
        'Titanium Duratorq',
      ]),
    ]),
    m('figo-aspire', 'Figo Aspire', 'SEDAN', 2015, 2021, [
      p('PETROL', 'MANUAL', 1194, 5, ['Ambiente', 'Trend', 'Titanium', 'Titanium+']),
      p('PETROL', 'AUTOMATIC', 1499, 5, ['Titanium AT', 'Titanium+ AT']),
      p('DIESEL', 'MANUAL', 1498, 5, [
        'Ambiente Diesel',
        'Trend Diesel',
        'Titanium Diesel',
        'Titanium+ Diesel',
      ]),
    ]),
    m('ecosport', 'EcoSport', 'SUV', 2013, 2021, [
      p('PETROL', 'MANUAL', 1497, 5, [
        'Ambiente',
        'Trend',
        'Titanium',
        'Titanium+',
        'S',
        'Thunder Edition',
      ]),
      p('PETROL', 'AUTOMATIC', 1497, 5, ['Titanium AT', 'Titanium+ AT', 'S AT']),
      p('PETROL', 'MANUAL', 999, 5, [
        '1.0 EcoBoost Titanium',
        '1.0 EcoBoost Platinum',
        '1.0 EcoBoost S',
      ]),
      p('DIESEL', 'MANUAL', 1498, 5, [
        'Ambiente Diesel',
        'Trend Diesel',
        'Titanium Diesel',
        'Titanium+ Diesel',
        'S Diesel',
      ]),
    ]),
    m('freestyle', 'Freestyle', 'HATCHBACK', 2018, 2021, [
      p('PETROL', 'MANUAL', 1194, 5, ['Ambiente', 'Trend', 'Titanium', 'Titanium+']),
      p('DIESEL', 'MANUAL', 1498, 5, [
        'Ambiente Diesel',
        'Trend Diesel',
        'Titanium Diesel',
        'Titanium+ Diesel',
      ]),
    ]),
    m('fiesta', 'Fiesta', 'SEDAN', 2005, 2015, [
      p('PETROL', 'MANUAL', 1499, 5, ['Ambiente', 'Trend', 'Titanium', 'Titanium+', 'Classic LXi']),
      p('PETROL', 'AUTOMATIC', 1499, 5, ['Titanium AT']),
      p('DIESEL', 'MANUAL', 1498, 5, [
        'Ambiente Diesel',
        'Trend Diesel',
        'Titanium Diesel',
        'Classic Titanium',
      ]),
    ]),
    m('endeavour', 'Endeavour', 'SUV', 2003, 2021, [
      p('DIESEL', 'MANUAL', 2198, 7, ['2.2 Trend 4x2', '2.2 Titanium 4x2']),
      p('DIESEL', 'AUTOMATIC', 2198, 7, ['2.2 Trend AT', '2.2 Titanium AT']),
      p('DIESEL', 'AUTOMATIC', 3198, 7, ['3.2 Titanium AT 4x4', '3.2 Sport AT 4x4']),
      p('DIESEL', 'MANUAL', 2953, 7, ['3.0 4x4 MT', '2.5 4x2 MT']),
    ]),
    m('mustang', 'Mustang', 'LUXURY', 2016, 2021, [
      p('PETROL', 'AUTOMATIC', 4951, 4, ['GT Fastback']),
    ]),
    m('ikon', 'Ikon', 'SEDAN', 1999, 2011, [
      p('PETROL', 'MANUAL', 1597, 5, ['1.6 Nxt', '1.3 Flair', 'Josh']),
      p('DIESEL', 'MANUAL', 1399, 5, ['1.4 TDCi Duratorq']),
    ]),
    m('classic', 'Fiesta Classic', 'SEDAN', 2011, 2015, [
      p('PETROL', 'MANUAL', 1596, 5, ['LXi', 'CLXi', 'SXi', 'Titanium']),
      p('DIESEL', 'MANUAL', 1399, 5, ['LXi TDCi', 'CLXi TDCi', 'Titanium TDCi']),
    ]),
  ]),

  make('chevrolet', 'Chevrolet', 38, [
    m('beat', 'Beat', 'HATCHBACK', 2010, 2017, [
      p('PETROL', 'MANUAL', 1199, 5, ['PS', 'LS', 'LT', 'LT Option']),
      p('DIESEL', 'MANUAL', 936, 5, ['PS Diesel', 'LS Diesel', 'LT Diesel']),
    ]),
    m('spark', 'Spark', 'HATCHBACK', 2007, 2016, [
      p('PETROL', 'MANUAL', 995, 5, ['PS', 'LS', 'LT', 'LT Option']),
    ]),
    m('sail', 'Sail', 'SEDAN', 2013, 2017, [
      p('PETROL', 'MANUAL', 1199, 5, ['Base', 'LS', 'LT', 'LT ABS']),
      p('DIESEL', 'MANUAL', 1248, 5, ['Base Diesel', 'LS Diesel', 'LT Diesel', 'LT ABS Diesel']),
    ]),
    m('sail-uva', 'Sail U-VA', 'HATCHBACK', 2012, 2017, [
      p('PETROL', 'MANUAL', 1199, 5, ['Base', 'LS', 'LT']),
      p('DIESEL', 'MANUAL', 1248, 5, ['LS Diesel', 'LT Diesel']),
    ]),
    m('cruze', 'Cruze', 'SEDAN', 2009, 2017, [
      p('DIESEL', 'MANUAL', 1998, 5, ['LT', 'LTZ']),
      p('DIESEL', 'AUTOMATIC', 1998, 5, ['LTZ AT']),
    ]),
    m('optra', 'Optra', 'SEDAN', 2003, 2012, [
      p('PETROL', 'MANUAL', 1598, 5, ['LS', 'LT', 'Magnum LS']),
      p('DIESEL', 'MANUAL', 1991, 5, ['Magnum LT Diesel']),
    ]),
    m('aveo', 'Aveo', 'SEDAN', 2006, 2012, [
      p('PETROL', 'MANUAL', 1399, 5, ['1.4 LS', '1.4 LT', '1.6 LT']),
      p('PETROL', 'MANUAL', 1199, 5, ['U-VA 1.2 LS', 'U-VA 1.2 LT']),
    ]),
    m('tavera', 'Tavera', 'MUV', 2004, 2017, [
      p('DIESEL', 'MANUAL', 2499, 10, ['Neo 3 LS', 'Neo 3 LT', 'B1', 'B2', 'B3', 'B4']),
    ]),
    m('enjoy', 'Enjoy', 'MUV', 2013, 2017, [
      p('DIESEL', 'MANUAL', 1248, 8, ['LS', 'LT', 'LTZ', 'Base Diesel']),
      p('PETROL', 'MANUAL', 1399, 8, ['LS Petrol', 'LT Petrol']),
    ]),
    m('captiva', 'Captiva', 'SUV', 2008, 2016, [
      p('DIESEL', 'AUTOMATIC', 2231, 7, ['LTZ AT', 'LT AT']),
      p('DIESEL', 'MANUAL', 1991, 7, ['LT MT']),
    ]),
    m('trailblazer', 'Trailblazer', 'SUV', 2015, 2017, [
      p('DIESEL', 'AUTOMATIC', 2776, 7, ['LTZ AT']),
    ]),
  ]),

  make('datsun', 'Datsun', 35, [
    m('go', 'GO', 'HATCHBACK', 2014, 2022, [
      p('PETROL', 'MANUAL', 1198, 5, ['D', 'D1', 'A', 'T', 'T (Option)', 'Remix']),
      p('PETROL', 'AUTOMATIC', 1198, 5, ['A CVT', 'T CVT', 'T (O) CVT']),
    ]),
    m('go-plus', 'GO+', 'MUV', 2015, 2022, [
      p('PETROL', 'MANUAL', 1198, 7, ['D', 'D1', 'A', 'T', 'T (Option)', 'Remix']),
      p('PETROL', 'AUTOMATIC', 1198, 7, ['A CVT', 'T CVT', 'T (O) CVT']),
    ]),
    m('redi-go', 'redi-GO', 'HATCHBACK', 2016, 2022, [
      p('PETROL', 'MANUAL', 799, 5, ['D', 'A', 'S', 'T', 'T (Option)']),
      p('PETROL', 'MANUAL', 999, 5, ['1.0 S', '1.0 T', '1.0 T (Option)']),
      p('PETROL', 'AUTOMATIC', 999, 5, ['1.0 S AMT', '1.0 T (O) AMT']),
    ]),
  ]),

  make('fiat', 'Fiat', 30, [
    m('punto', 'Punto', 'HATCHBACK', 2009, 2019, [
      p('PETROL', 'MANUAL', 1172, 5, ['Active', 'Dynamic', 'Emotion', 'Pure', 'Evo Active']),
      p('DIESEL', 'MANUAL', 1248, 5, [
        'Active Diesel',
        'Dynamic Diesel',
        'Emotion Diesel',
        'Evo Emotion',
      ]),
      p('DIESEL', 'MANUAL', 1598, 5, ['Abarth 1.4', 'Sport 90HP']),
    ]),
    m('linea', 'Linea', 'SEDAN', 2009, 2019, [
      p('PETROL', 'MANUAL', 1368, 5, ['Active', 'Dynamic', 'Emotion', 'T-Jet']),
      p('DIESEL', 'MANUAL', 1248, 5, ['Active Diesel', 'Dynamic Diesel', 'Emotion Diesel']),
    ]),
    m('avventura', 'Avventura', 'HATCHBACK', 2014, 2019, [
      p('PETROL', 'MANUAL', 1368, 5, ['Active', 'Dynamic', 'Emotion']),
      p('DIESEL', 'MANUAL', 1248, 5, ['Active Diesel', 'Dynamic Diesel', 'Emotion Diesel']),
    ]),
    m('urban-cross', 'Urban Cross', 'HATCHBACK', 2016, 2019, [
      p('PETROL', 'MANUAL', 1368, 5, ['Active', 'Dynamic', 'Emotion']),
      p('DIESEL', 'MANUAL', 1248, 5, ['Dynamic Diesel', 'Emotion Diesel']),
    ]),
    m('palio', 'Palio', 'HATCHBACK', 2001, 2012, [
      p('PETROL', 'MANUAL', 1242, 5, ['Stile 1.2 SLX', 'NV 1.2 EL']),
      p('DIESEL', 'MANUAL', 1368, 5, ['Stile 1.3 Multijet']),
    ]),
  ]),

  make('citroen', 'Citroen', 40, [
    m('c3', 'C3', 'HATCHBACK', 2022, null, [
      p('PETROL', 'MANUAL', 1198, 5, ['Live', 'Feel', 'Shine']),
      p('PETROL', 'MANUAL', 1199, 5, ['Feel Turbo', 'Shine Turbo']),
      p('PETROL', 'AUTOMATIC', 1199, 5, ['Shine Turbo AT']),
    ]),
    m('ec3', 'eC3', 'HATCHBACK', 2023, null, [
      p('ELECTRIC', 'AUTOMATIC', null, 5, ['Live', 'Feel', 'Shine']),
    ]),
    m('c3-aircross', 'C3 Aircross', 'SUV', 2023, null, [
      p('PETROL', 'MANUAL', 1199, 7, ['You', 'Plus', 'Max']),
      p('PETROL', 'AUTOMATIC', 1199, 5, ['Plus AT', 'Max AT']),
    ]),
    m('c5-aircross', 'C5 Aircross', 'SUV', 2021, null, [
      p('DIESEL', 'AUTOMATIC', 1997, 5, ['Feel', 'Shine']),
    ]),
    m('basalt', 'Basalt', 'SUV', 2024, null, [
      p('PETROL', 'MANUAL', 1199, 5, ['You', 'Plus', 'Max']),
      p('PETROL', 'AUTOMATIC', 1199, 5, ['Plus AT', 'Max AT']),
    ]),
  ]),

  make('jeep', 'Jeep', 50, [
    m('compass', 'Compass', 'SUV', 2017, null, [
      p('DIESEL', 'MANUAL', 1956, 5, [
        'Sport',
        'Longitude',
        'Longitude (O)',
        'Limited',
        'Limited Plus',
        'Longitude 4x2',
      ]),
      p('DIESEL', 'AUTOMATIC', 1956, 5, [
        'Limited AT',
        'Limited Plus AT',
        'Model S AT',
        'Trailhawk 4x4 AT',
      ]),
      p('PETROL', 'MANUAL', 1368, 5, ['Sport Petrol', 'Longitude Petrol']),
      p('PETROL', 'AUTOMATIC', 1368, 5, [
        'Longitude Petrol DCT',
        'Limited Petrol DCT',
        'Model S Petrol DCT',
      ]),
    ]),
    m('meridian', 'Meridian', 'SUV', 2022, null, [
      p('DIESEL', 'MANUAL', 1956, 7, ['Longitude', 'Limited']),
      p('DIESEL', 'AUTOMATIC', 1956, 7, ['Limited AT', 'Limited (O) AT', 'Overland 4x4 AT']),
    ]),
    m('wrangler', 'Wrangler', 'SUV', 2016, null, [
      p('PETROL', 'AUTOMATIC', 1995, 5, ['Unlimited', 'Rubicon']),
      p('DIESEL', 'AUTOMATIC', 2143, 5, ['Unlimited Diesel']),
    ]),
    m('grand-cherokee', 'Grand Cherokee', 'LUXURY', 2016, null, [
      p('DIESEL', 'AUTOMATIC', 2987, 5, ['Limited', 'Summit', 'Trackhawk']),
      p('PETROL', 'AUTOMATIC', 1995, 5, ['Limited (O) Petrol']),
    ]),
  ]),

  make('isuzu', 'Isuzu', 20, [
    m('d-max-v-cross', 'D-Max V-Cross', 'SUV', 2016, null, [
      p('DIESEL', 'MANUAL', 1898, 5, ['Standard', 'High', 'Z', 'Z Prestige']),
      p('DIESEL', 'AUTOMATIC', 1898, 5, ['Z AT', 'Z Prestige AT']),
      p('DIESEL', 'MANUAL', 2499, 5, ['2.5 4x4']),
    ]),
    m('mu-x', 'MU-X', 'SUV', 2017, null, [p('DIESEL', 'AUTOMATIC', 2999, 7, ['4x2 AT', '4x4 AT'])]),
    m('d-max', 'D-Max', 'SUV', 2013, null, [
      p('DIESEL', 'MANUAL', 2499, 5, ['Regular Cab', 'S-Cab', 'Flat Deck']),
    ]),
  ]),

  make('force', 'Force Motors', 18, [
    m('gurkha', 'Gurkha', 'SUV', 2013, null, [
      p('DIESEL', 'MANUAL', 2596, 5, ['Xplorer 4x4', 'Xtreme 4x4', '3-Door 4x4', '5-Door 4x4']),
    ]),
    m('trax', 'Trax', 'MUV', 2000, null, [
      p('DIESEL', 'MANUAL', 2596, 10, ['Cruiser', 'Toofan', 'Kargo']),
    ]),
    m('urbania', 'Urbania', 'MUV', 2023, null, [
      p('DIESEL', 'MANUAL', 2596, 13, ['10 Seater', '13 Seater', '17 Seater']),
    ]),
  ]),

  make('mitsubishi', 'Mitsubishi', 16, [
    m('pajero-sport', 'Pajero Sport', 'SUV', 2012, 2020, [
      p('DIESEL', 'MANUAL', 2477, 7, ['4x2 MT', '4x4 MT']),
      p('DIESEL', 'AUTOMATIC', 2477, 7, ['4x2 AT', '4x4 AT']),
    ]),
    m('pajero', 'Pajero', 'SUV', 2002, 2017, [p('DIESEL', 'MANUAL', 2835, 7, ['SFX 2.8', 'GLX'])]),
    m('outlander', 'Outlander', 'SUV', 2007, 2017, [p('PETROL', 'AUTOMATIC', 2360, 5, ['2.4 AT'])]),
    m('lancer', 'Lancer', 'SEDAN', 1998, 2012, [
      p('PETROL', 'MANUAL', 1468, 5, ['LXi', 'SFX', 'Cedia Sports']),
      p('DIESEL', 'MANUAL', 1998, 5, ['SFX Diesel']),
    ]),
    m('montero', 'Montero', 'SUV', 2007, 2013, [p('DIESEL', 'AUTOMATIC', 3200, 7, ['3.2 AT'])]),
  ]),

  make('byd', 'BYD', 15, [
    m('e6', 'e6', 'MUV', 2022, null, [p('ELECTRIC', 'AUTOMATIC', null, 5, ['Base'])]),
    m('atto-3', 'Atto 3', 'SUV', 2022, null, [
      p('ELECTRIC', 'AUTOMATIC', null, 5, ['Dynamic', 'Premium', 'Superior']),
    ]),
    m('seal', 'Seal', 'LUXURY', 2024, null, [
      p('ELECTRIC', 'AUTOMATIC', null, 5, ['Dynamic', 'Premium', 'Performance AWD']),
    ]),
    m('emax-7', 'eMAX 7', 'MUV', 2024, null, [
      p('ELECTRIC', 'AUTOMATIC', null, 7, ['Premium 6-Seater', 'Superior 7-Seater']),
    ]),
  ]),

  make('ssangyong', 'SsangYong', 10, [
    m('rexton', 'Rexton', 'SUV', 2012, 2017, [
      p('DIESEL', 'MANUAL', 2696, 7, ['RX5']),
      p('DIESEL', 'AUTOMATIC', 2696, 7, ['RX6', 'RX7']),
    ]),
  ]),

  make('hindustan-motors', 'Hindustan Motors', 8, [
    m('ambassador', 'Ambassador', 'SEDAN', 1958, 2014, [
      p('DIESEL', 'MANUAL', 1995, 5, ['Grand 2000 DSZ', 'Classic 2000 DSZ', 'Encore']),
      p('PETROL', 'MANUAL', 1817, 5, ['Grand 1800 ISZ', 'Avigo 1.8']),
    ]),
    m('contessa', 'Contessa', 'SEDAN', 1984, 2002, [
      p('PETROL', 'MANUAL', 1817, 5, ['Classic 1.8 GLX']),
    ]),
  ]),

  make('premier', 'Premier', 5, [
    m('rio', 'Rio', 'SUV', 2009, 2015, [p('DIESEL', 'MANUAL', 1461, 5, ['GLX', 'GLS'])]),
  ]),

  make('tesla', 'Tesla', 12, [
    m('model-3', 'Model 3', 'LUXURY', 2025, null, [
      p('ELECTRIC', 'AUTOMATIC', null, 5, ['Rear-Wheel Drive', 'Long Range AWD']),
    ]),
    m('model-y', 'Model Y', 'SUV', 2025, null, [
      p('ELECTRIC', 'AUTOMATIC', null, 5, ['Rear-Wheel Drive', 'Long Range AWD']),
    ]),
  ]),
];
