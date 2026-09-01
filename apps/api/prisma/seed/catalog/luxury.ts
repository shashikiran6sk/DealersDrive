/**
 * The premium and exotic marques.
 *
 * Body type is `LUXURY` for saloons and coupés and `SUV` for the SUVs, because
 * that is what the marketplace's browse tiles offer (§2.11) and what a buyer
 * filtering for "Luxury" means. A used C-Class competes with a used 3 Series,
 * not with a Dzire, so filing both under `SEDAN` would put them in the wrong
 * comparison set.
 *
 * The exotics carry a handful of models each and low `popularity` — they are
 * here so the dropdown is not embarrassing when a Chennai dealer lists a 911,
 * not because volume is expected.
 */
import { m, make, p, type CatalogMake } from './schema.js';

export const LUXURY: CatalogMake[] = [
  make('mercedes-benz', 'Mercedes-Benz', 45, [
    m('a-class', 'A-Class', 'LUXURY', 2013, null, [
      p('PETROL', 'AUTOMATIC', 1332, 5, ['A200 Limousine', 'A180 Sport']),
      p('DIESEL', 'AUTOMATIC', 1950, 5, ['A200d Limousine', 'A180 CDI']),
      p('PETROL', 'AUTOMATIC', 1991, 5, ['AMG A35 4MATIC', 'AMG A45 S']),
    ]),
    m('b-class', 'B-Class', 'LUXURY', 2012, 2019, [
      p('PETROL', 'AUTOMATIC', 1595, 5, ['B180 Sport']),
      p('DIESEL', 'AUTOMATIC', 2143, 5, ['B200 CDI']),
    ]),
    m('c-class', 'C-Class', 'LUXURY', 2007, null, [
      p('PETROL', 'AUTOMATIC', 1497, 5, ['C200', 'C200 Avantgarde', 'C200 Progressive']),
      p('DIESEL', 'AUTOMATIC', 1993, 5, ['C220d', 'C220d Prime', 'C300d AMG Line']),
      p('PETROL', 'AUTOMATIC', 2996, 5, ['AMG C43 4MATIC', 'AMG C63 S']),
    ]),
    m('e-class', 'E-Class', 'LUXURY', 2002, null, [
      p('PETROL', 'AUTOMATIC', 1991, 5, ['E200', 'E200 Exclusive', 'E250']),
      p('DIESEL', 'AUTOMATIC', 1993, 5, ['E220d', 'E220d Exclusive', 'E350d']),
      p('PETROL', 'AUTOMATIC', 2999, 5, ['E450 4MATIC', 'AMG E53', 'AMG E63 S']),
    ]),
    m('s-class', 'S-Class', 'LUXURY', 2006, null, [
      p('PETROL', 'AUTOMATIC', 2999, 5, ['S450', 'S500', 'S350']),
      p('DIESEL', 'AUTOMATIC', 2925, 5, ['S350d', 'S400d Maybach']),
      p('PETROL', 'AUTOMATIC', 3982, 5, ['AMG S63', 'Maybach S580']),
    ]),
    m('cla', 'CLA', 'LUXURY', 2015, null, [
      p('PETROL', 'AUTOMATIC', 1332, 5, ['CLA200', 'CLA200 Urban Sport']),
      p('DIESEL', 'AUTOMATIC', 2143, 5, ['CLA200d', 'CLA220d']),
      p('PETROL', 'AUTOMATIC', 1991, 5, ['AMG CLA45', 'AMG CLA35']),
    ]),
    m('gla', 'GLA', 'SUV', 2014, null, [
      p('PETROL', 'AUTOMATIC', 1332, 5, ['GLA200', 'GLA200 Progressive']),
      p('DIESEL', 'AUTOMATIC', 1950, 5, ['GLA220d', 'GLA200d']),
      p('PETROL', 'AUTOMATIC', 1991, 5, ['AMG GLA35 4MATIC', 'AMG GLA45']),
    ]),
    m('glb', 'GLB', 'SUV', 2022, null, [
      p('PETROL', 'AUTOMATIC', 1332, 7, ['GLB200']),
      p('DIESEL', 'AUTOMATIC', 1950, 7, ['GLB220d 4MATIC']),
    ]),
    m('glc', 'GLC', 'SUV', 2016, null, [
      p('PETROL', 'AUTOMATIC', 1999, 5, ['GLC300 4MATIC', 'GLC200 Progressive']),
      p('DIESEL', 'AUTOMATIC', 1993, 5, ['GLC220d', 'GLC300d AMG Line']),
      p('PETROL', 'AUTOMATIC', 2996, 5, ['AMG GLC43 Coupe']),
    ]),
    m('gle', 'GLE', 'SUV', 2015, null, [
      p('PETROL', 'AUTOMATIC', 2999, 5, ['GLE450 4MATIC', 'GLE400 4MATIC']),
      p('DIESEL', 'AUTOMATIC', 2925, 5, ['GLE300d', 'GLE350d', 'GLE400d']),
      p('PETROL', 'AUTOMATIC', 3982, 5, ['AMG GLE53', 'AMG GLE63 S']),
    ]),
    m('gls', 'GLS', 'SUV', 2016, null, [
      p('PETROL', 'AUTOMATIC', 2999, 7, ['GLS450 4MATIC']),
      p('DIESEL', 'AUTOMATIC', 2925, 7, ['GLS400d 4MATIC', 'GLS350d']),
      p('PETROL', 'AUTOMATIC', 3982, 7, ['Maybach GLS600', 'AMG GLS63']),
    ]),
    m('g-class', 'G-Class', 'SUV', 2018, null, [
      p('DIESEL', 'AUTOMATIC', 2925, 5, ['G350d', 'G400d']),
      p('PETROL', 'AUTOMATIC', 3982, 5, ['AMG G63']),
    ]),
    m('ml-class', 'M-Class', 'SUV', 2006, 2015, [
      p('DIESEL', 'AUTOMATIC', 2987, 5, ['ML250 CDI', 'ML350 CDI']),
    ]),
    m('eqs', 'EQS', 'LUXURY', 2022, null, [
      p('ELECTRIC', 'AUTOMATIC', null, 5, ['EQS 580 4MATIC', 'Maybach EQS SUV']),
    ]),
    m('eqb', 'EQB', 'SUV', 2022, null, [
      p('ELECTRIC', 'AUTOMATIC', null, 7, ['EQB 300 4MATIC', 'EQB 350']),
    ]),
  ]),

  make('bmw', 'BMW', 44, [
    m('1-series', '1 Series', 'LUXURY', 2013, 2019, [
      p('PETROL', 'AUTOMATIC', 1598, 5, ['116i Sport']),
      p('DIESEL', 'AUTOMATIC', 1995, 5, ['118d Sport', '118d M Sport']),
    ]),
    m('2-series', '2 Series', 'LUXURY', 2022, null, [
      p('PETROL', 'AUTOMATIC', 1998, 5, ['220i M Sport Gran Coupe']),
      p('DIESEL', 'AUTOMATIC', 1995, 5, ['220d M Sport Gran Coupe']),
    ]),
    m('3-series', '3 Series', 'LUXURY', 2005, null, [
      p('PETROL', 'AUTOMATIC', 1998, 5, ['330i M Sport', '320i Luxury Line', '330Li M Sport']),
      p('DIESEL', 'AUTOMATIC', 1995, 5, ['320d Luxury Line', '320d Sport', '320Ld M Sport']),
      p('PETROL', 'AUTOMATIC', 2998, 5, ['M340i xDrive']),
    ]),
    m('5-series', '5 Series', 'LUXURY', 2003, null, [
      p('PETROL', 'AUTOMATIC', 1998, 5, ['530i M Sport', '520i Luxury Line']),
      p('DIESEL', 'AUTOMATIC', 1995, 5, ['520d Luxury Line', '520d M Sport', '530d M Sport']),
    ]),
    m('6-series-gt', '6 Series GT', 'LUXURY', 2018, null, [
      p('PETROL', 'AUTOMATIC', 1998, 5, ['630i M Sport']),
      p('DIESEL', 'AUTOMATIC', 2993, 5, ['630d M Sport', '620d Luxury Line']),
    ]),
    m('7-series', '7 Series', 'LUXURY', 2009, null, [
      p('PETROL', 'AUTOMATIC', 2998, 5, ['740i M Sport', '730Li M Sport']),
      p('DIESEL', 'AUTOMATIC', 2993, 5, ['730Ld DPE', '730Ld M Sport']),
    ]),
    m('x1', 'X1', 'SUV', 2010, null, [
      p('PETROL', 'AUTOMATIC', 1499, 5, ['sDrive18i M Sport', 'sDrive20i xLine']),
      p('DIESEL', 'AUTOMATIC', 1995, 5, [
        'sDrive20d xLine',
        'sDrive18d Expedition',
        'sDrive20d M Sport',
      ]),
    ]),
    m('x3', 'X3', 'SUV', 2011, null, [
      p('PETROL', 'AUTOMATIC', 1998, 5, ['xDrive30i M Sport', 'xDrive20i Luxury Line']),
      p('DIESEL', 'AUTOMATIC', 1995, 5, [
        'xDrive20d Luxury Line',
        'xDrive20d M Sport',
        'xDrive30d M Sport',
      ]),
    ]),
    m('x4', 'X4', 'SUV', 2019, null, [
      p('PETROL', 'AUTOMATIC', 1998, 5, ['xDrive30i M Sport X']),
      p('DIESEL', 'AUTOMATIC', 1995, 5, ['xDrive20d M Sport X']),
    ]),
    m('x5', 'X5', 'SUV', 2007, null, [
      p('PETROL', 'AUTOMATIC', 2998, 5, ['xDrive40i M Sport']),
      p('DIESEL', 'AUTOMATIC', 2993, 7, ['xDrive30d xLine', 'xDrive30d M Sport', 'xDrive40d']),
    ]),
    m('x7', 'X7', 'SUV', 2019, null, [
      p('PETROL', 'AUTOMATIC', 2998, 7, ['xDrive40i M Sport']),
      p('DIESEL', 'AUTOMATIC', 2993, 7, ['xDrive30d DPE Signature', 'xDrive40d M Sport']),
    ]),
    m('z4', 'Z4', 'LUXURY', 2010, null, [
      p('PETROL', 'AUTOMATIC', 1998, 2, ['sDrive20i M Sport', 'sDrive30i M Sport']),
    ]),
    m('i4', 'i4', 'LUXURY', 2022, null, [
      p('ELECTRIC', 'AUTOMATIC', null, 5, ['eDrive40 M Sport', 'M50']),
    ]),
    m('ix', 'iX', 'SUV', 2022, null, [
      p('ELECTRIC', 'AUTOMATIC', null, 5, ['xDrive40', 'xDrive50']),
    ]),
    m('m-series', 'M Series', 'LUXURY', 2015, null, [
      p('PETROL', 'AUTOMATIC', 2993, 5, ['M2 Competition', 'M4 Competition']),
      p('PETROL', 'AUTOMATIC', 4395, 5, ['M5 Competition', 'X5 M', 'X6 M']),
    ]),
  ]),

  make('audi', 'Audi', 43, [
    m('a3', 'A3', 'LUXURY', 2014, 2020, [
      p('PETROL', 'AUTOMATIC', 1395, 5, ['35 TFSI Premium Plus', '40 TFSI Technology']),
      p('DIESEL', 'AUTOMATIC', 1968, 5, ['35 TDI Premium Plus', '35 TDI Technology']),
    ]),
    m('a4', 'A4', 'LUXURY', 2008, null, [
      p('PETROL', 'AUTOMATIC', 1984, 5, [
        '40 TFSI Premium Plus',
        '40 TFSI Technology',
        '30 TFSI Premium',
      ]),
      p('DIESEL', 'AUTOMATIC', 1968, 5, [
        '35 TDI Premium Plus',
        '35 TDI Technology',
        '30 TDI Premium',
      ]),
    ]),
    m('a6', 'A6', 'LUXURY', 2005, null, [
      p('PETROL', 'AUTOMATIC', 1984, 5, ['45 TFSI Premium Plus', '45 TFSI Technology']),
      p('DIESEL', 'AUTOMATIC', 1968, 5, ['35 TDI Matrix', '35 TDI Technology']),
    ]),
    m('a8', 'A8 L', 'LUXURY', 2011, null, [
      p('PETROL', 'AUTOMATIC', 2995, 5, ['55 TFSI quattro', '60 TFSI']),
      p('DIESEL', 'AUTOMATIC', 2967, 5, ['50 TDI quattro']),
    ]),
    m('q2', 'Q2', 'SUV', 2020, 2023, [
      p('PETROL', 'AUTOMATIC', 1984, 5, [
        '35 TFSI Premium',
        '35 TFSI Premium Plus',
        '35 TFSI Technology',
      ]),
    ]),
    m('q3', 'Q3', 'SUV', 2012, null, [
      p('PETROL', 'AUTOMATIC', 1984, 5, ['40 TFSI quattro Premium Plus', '40 TFSI Technology']),
      p('DIESEL', 'AUTOMATIC', 1968, 5, ['35 TDI quattro Premium Plus', '30 TDI Premium']),
    ]),
    m('q5', 'Q5', 'SUV', 2009, null, [
      p('PETROL', 'AUTOMATIC', 1984, 5, ['45 TFSI Premium Plus', '45 TFSI Technology']),
      p('DIESEL', 'AUTOMATIC', 1968, 5, ['35 TDI Premium Plus', '40 TDI Technology']),
    ]),
    m('q7', 'Q7', 'SUV', 2006, null, [
      p('PETROL', 'AUTOMATIC', 2995, 7, ['55 TFSI quattro Premium Plus', '55 TFSI Technology']),
      p('DIESEL', 'AUTOMATIC', 2967, 7, ['45 TDI quattro', '35 TDI Premium Plus']),
    ]),
    m('q8', 'Q8', 'SUV', 2020, null, [
      p('PETROL', 'AUTOMATIC', 2995, 5, ['55 TFSI quattro Celebration']),
    ]),
    m('e-tron', 'e-tron', 'SUV', 2021, null, [
      p('ELECTRIC', 'AUTOMATIC', null, 5, ['50 quattro', '55 quattro', 'Sportback 55']),
    ]),
    m('rs-series', 'RS Series', 'LUXURY', 2015, null, [
      p('PETROL', 'AUTOMATIC', 2894, 5, ['RS5 Sportback', 'RS Q8', 'RS7 Sportback']),
    ]),
    m('tt', 'TT', 'LUXURY', 2007, 2020, [p('PETROL', 'AUTOMATIC', 1984, 4, ['45 TFSI'])]),
  ]),

  make('volvo', 'Volvo', 36, [
    m('s60', 'S60', 'LUXURY', 2011, null, [
      p('PETROL', 'AUTOMATIC', 1969, 5, ['B5 Ultimate', 'T4 Inscription']),
      p('DIESEL', 'AUTOMATIC', 1969, 5, ['D4 Inscription', 'D4 Kinetic']),
    ]),
    m('s90', 'S90', 'LUXURY', 2016, null, [
      p('PETROL', 'AUTOMATIC', 1969, 5, ['B5 Ultimate', 'T4 Momentum']),
      p('DIESEL', 'AUTOMATIC', 1969, 5, ['D4 Inscription']),
    ]),
    m('xc40', 'XC40', 'SUV', 2018, null, [
      p('PETROL', 'AUTOMATIC', 1969, 5, ['T4 R-Design', 'B4 Ultimate']),
      p('DIESEL', 'AUTOMATIC', 1969, 5, ['D4 Inscription', 'D4 Momentum']),
    ]),
    m('xc40-recharge', 'XC40 Recharge', 'SUV', 2022, null, [
      p('ELECTRIC', 'AUTOMATIC', null, 5, ['P8 AWD', 'Single Motor']),
    ]),
    m('xc60', 'XC60', 'SUV', 2009, null, [
      p('PETROL', 'AUTOMATIC', 1969, 5, ['B5 Ultimate', 'T5 Inscription']),
      p('DIESEL', 'AUTOMATIC', 1969, 5, ['D5 Inscription', 'D4 Momentum']),
    ]),
    m('xc90', 'XC90', 'SUV', 2007, null, [
      p('PETROL', 'AUTOMATIC', 1969, 7, ['B6 Ultimate', 'T8 Excellence']),
      p('DIESEL', 'AUTOMATIC', 1969, 7, ['D5 Inscription', 'D5 Momentum']),
    ]),
    m('c40-recharge', 'C40 Recharge', 'SUV', 2023, null, [
      p('ELECTRIC', 'AUTOMATIC', null, 5, ['Twin Motor']),
    ]),
  ]),

  make('land-rover', 'Land Rover', 34, [
    m('discovery-sport', 'Discovery Sport', 'SUV', 2015, null, [
      p('PETROL', 'AUTOMATIC', 1997, 7, ['S P250', 'SE P250', 'R-Dynamic SE']),
      p('DIESEL', 'AUTOMATIC', 1999, 7, ['S D200', 'SE D200', 'HSE Luxury']),
    ]),
    m('discovery', 'Discovery', 'SUV', 2010, null, [
      p('PETROL', 'AUTOMATIC', 2996, 7, ['S P300', 'HSE P360']),
      p('DIESEL', 'AUTOMATIC', 2993, 7, ['S D300', 'HSE Luxury D300', 'SE D250']),
    ]),
    m('range-rover-evoque', 'Range Rover Evoque', 'SUV', 2011, null, [
      p('PETROL', 'AUTOMATIC', 1997, 5, ['S P200', 'SE P250', 'R-Dynamic SE']),
      p('DIESEL', 'AUTOMATIC', 1999, 5, ['S D200', 'SE D180', 'HSE Dynamic']),
    ]),
    m('range-rover-velar', 'Range Rover Velar', 'SUV', 2017, null, [
      p('PETROL', 'AUTOMATIC', 1997, 5, ['S P250', 'R-Dynamic SE P250']),
      p('DIESEL', 'AUTOMATIC', 1999, 5, ['S D200', 'R-Dynamic SE D200']),
    ]),
    m('range-rover-sport', 'Range Rover Sport', 'SUV', 2010, null, [
      p('PETROL', 'AUTOMATIC', 2996, 5, ['SE P360', 'HSE Dynamic P400']),
      p('DIESEL', 'AUTOMATIC', 2993, 5, ['SE D300', 'HSE Dynamic D350']),
    ]),
    m('range-rover', 'Range Rover', 'SUV', 2010, null, [
      p('PETROL', 'AUTOMATIC', 2996, 5, ['SE P400', 'Autobiography P530']),
      p('DIESEL', 'AUTOMATIC', 2993, 5, ['SE D350', 'Autobiography LWB D350']),
    ]),
    m('defender', 'Defender', 'SUV', 2020, null, [
      p('PETROL', 'AUTOMATIC', 1997, 5, ['90 S P300', '110 SE P300']),
      p('DIESEL', 'AUTOMATIC', 2993, 7, ['110 SE D300', '130 HSE D300']),
    ]),
    m('freelander', 'Freelander 2', 'SUV', 2008, 2015, [
      p('DIESEL', 'AUTOMATIC', 2179, 5, ['SE', 'HSE', 'S']),
    ]),
  ]),

  make('jaguar', 'Jaguar', 30, [
    m('xe', 'XE', 'LUXURY', 2016, 2021, [
      p('PETROL', 'AUTOMATIC', 1997, 5, ['Prestige', 'Portfolio', 'R-Dynamic S']),
      p('DIESEL', 'AUTOMATIC', 1999, 5, ['Prestige Diesel', 'Portfolio Diesel']),
    ]),
    m('xf', 'XF', 'LUXURY', 2009, null, [
      p('PETROL', 'AUTOMATIC', 1997, 5, ['Prestige', 'Portfolio', 'R-Dynamic S']),
      p('DIESEL', 'AUTOMATIC', 1999, 5, ['Prestige Diesel', 'Portfolio Diesel']),
    ]),
    m('xj', 'XJ', 'LUXURY', 2010, 2020, [
      p('PETROL', 'AUTOMATIC', 2995, 5, ['3.0 L Portfolio']),
      p('DIESEL', 'AUTOMATIC', 2993, 5, ['3.0 L Diesel Portfolio']),
    ]),
    m('f-pace', 'F-Pace', 'SUV', 2016, null, [
      p('PETROL', 'AUTOMATIC', 1997, 5, ['Prestige', 'R-Dynamic S']),
      p('DIESEL', 'AUTOMATIC', 1999, 5, ['Prestige Diesel', 'Portfolio Diesel']),
    ]),
    m('f-type', 'F-Type', 'LUXURY', 2013, 2024, [
      p('PETROL', 'AUTOMATIC', 2995, 2, ['Coupe', 'Convertible', 'R-Dynamic']),
    ]),
    m('i-pace', 'I-Pace', 'SUV', 2021, null, [
      p('ELECTRIC', 'AUTOMATIC', null, 5, ['S', 'SE', 'HSE']),
    ]),
  ]),

  make('lexus', 'Lexus', 26, [
    m('es', 'ES', 'LUXURY', 2018, null, [
      p('HYBRID', 'AUTOMATIC', 2487, 5, ['300h Exquisite', '300h Luxury']),
    ]),
    m('nx', 'NX', 'SUV', 2018, null, [
      p('HYBRID', 'AUTOMATIC', 2494, 5, ['300h Exquisite', '350h Luxury', '350h F-Sport']),
    ]),
    m('rx', 'RX', 'SUV', 2018, null, [
      p('HYBRID', 'AUTOMATIC', 3456, 7, ['450h Luxury', '350h Luxury']),
    ]),
    m('lx', 'LX', 'SUV', 2018, null, [
      p('DIESEL', 'AUTOMATIC', 3346, 7, ['LX500d Ultra Luxury']),
      p('PETROL', 'AUTOMATIC', 3445, 7, ['LX570']),
    ]),
    m('ls', 'LS', 'LUXURY', 2018, null, [p('HYBRID', 'AUTOMATIC', 3456, 5, ['500h Ultra Luxury'])]),
  ]),

  make('mini', 'MINI', 24, [
    m('cooper', 'Cooper', 'LUXURY', 2012, null, [
      p('PETROL', 'AUTOMATIC', 1998, 4, ['S 3-Door', 'S Convertible', 'JCW']),
      p('PETROL', 'AUTOMATIC', 1499, 5, ['Cooper 5-Door']),
    ]),
    m('countryman', 'Countryman', 'SUV', 2013, null, [
      p('PETROL', 'AUTOMATIC', 1998, 5, ['Cooper S']),
      p('DIESEL', 'AUTOMATIC', 1995, 5, ['Cooper D']),
    ]),
    m('cooper-se', 'Cooper SE', 'LUXURY', 2022, null, [
      p('ELECTRIC', 'AUTOMATIC', null, 4, ['3-Door']),
    ]),
  ]),

  make('porsche', 'Porsche', 22, [
    m('macan', 'Macan', 'SUV', 2014, null, [
      p('PETROL', 'AUTOMATIC', 1984, 5, ['Base', 'S', 'GTS']),
    ]),
    m('cayenne', 'Cayenne', 'SUV', 2010, null, [
      p('PETROL', 'AUTOMATIC', 2995, 5, ['Base', 'S', 'Coupe', 'Turbo GT']),
    ]),
    m('panamera', 'Panamera', 'LUXURY', 2010, null, [
      p('PETROL', 'AUTOMATIC', 2894, 4, ['Base', '4 E-Hybrid', 'GTS']),
    ]),
    m('911', '911', 'LUXURY', 2010, null, [
      p('PETROL', 'AUTOMATIC', 2981, 4, ['Carrera', 'Carrera S', 'Turbo S', 'GT3']),
    ]),
    m('taycan', 'Taycan', 'LUXURY', 2021, null, [
      p('ELECTRIC', 'AUTOMATIC', null, 4, ['Base', '4S', 'Turbo S', 'Cross Turismo']),
    ]),
    m('718', '718', 'LUXURY', 2016, null, [
      p('PETROL', 'AUTOMATIC', 1988, 2, ['Cayman', 'Boxster', 'Cayman GTS']),
    ]),
  ]),

  make('maserati', 'Maserati', 4, [
    m('ghibli', 'Ghibli', 'LUXURY', 2015, null, [
      p('PETROL', 'AUTOMATIC', 2979, 5, ['GranLusso', 'GranSport']),
    ]),
    m('levante', 'Levante', 'SUV', 2017, null, [
      p('PETROL', 'AUTOMATIC', 2979, 5, ['GranLusso', 'Trofeo']),
    ]),
    m('quattroporte', 'Quattroporte', 'LUXURY', 2013, null, [
      p('PETROL', 'AUTOMATIC', 2979, 5, ['GranLusso', 'GTS']),
    ]),
  ]),

  make('bentley', 'Bentley', 3, [
    m('continental-gt', 'Continental GT', 'LUXURY', 2010, null, [
      p('PETROL', 'AUTOMATIC', 5950, 4, ['V8', 'W12', 'Convertible']),
    ]),
    m('bentayga', 'Bentayga', 'SUV', 2016, null, [
      p('PETROL', 'AUTOMATIC', 3996, 5, ['V8', 'W12', 'EWB']),
    ]),
    m('flying-spur', 'Flying Spur', 'LUXURY', 2014, null, [
      p('PETROL', 'AUTOMATIC', 5950, 5, ['V8', 'W12']),
    ]),
  ]),

  make('rolls-royce', 'Rolls-Royce', 2, [
    m('ghost', 'Ghost', 'LUXURY', 2010, null, [
      p('PETROL', 'AUTOMATIC', 6592, 5, ['Standard', 'Extended', 'Black Badge']),
    ]),
    m('phantom', 'Phantom', 'LUXURY', 2010, null, [
      p('PETROL', 'AUTOMATIC', 6749, 5, ['Standard', 'Extended']),
    ]),
    m('cullinan', 'Cullinan', 'SUV', 2018, null, [
      p('PETROL', 'AUTOMATIC', 6749, 5, ['Standard', 'Black Badge']),
    ]),
    m('wraith', 'Wraith', 'LUXURY', 2013, null, [
      p('PETROL', 'AUTOMATIC', 6592, 4, ['Standard', 'Black Badge']),
    ]),
  ]),

  make('ferrari', 'Ferrari', 3, [
    m('portofino', 'Portofino', 'LUXURY', 2018, null, [
      p('PETROL', 'AUTOMATIC', 3855, 4, ['M', 'Standard']),
    ]),
    m('roma', 'Roma', 'LUXURY', 2021, null, [
      p('PETROL', 'AUTOMATIC', 3855, 4, ['Standard', 'Spider']),
    ]),
    m('f8', 'F8', 'LUXURY', 2020, null, [p('PETROL', 'AUTOMATIC', 3902, 2, ['Tributo', 'Spider'])]),
    m('488', '488', 'LUXURY', 2015, 2020, [
      p('PETROL', 'AUTOMATIC', 3902, 2, ['GTB', 'Spider', 'Pista']),
    ]),
  ]),

  make('lamborghini', 'Lamborghini', 3, [
    m('huracan', 'Huracan', 'LUXURY', 2014, null, [
      p('PETROL', 'AUTOMATIC', 5204, 2, ['EVO', 'STO', 'Tecnica', 'Spyder']),
    ]),
    m('urus', 'Urus', 'SUV', 2018, null, [
      p('PETROL', 'AUTOMATIC', 3996, 5, ['Standard', 'Performante', 'S']),
    ]),
    m('aventador', 'Aventador', 'LUXURY', 2012, 2022, [
      p('PETROL', 'AUTOMATIC', 6498, 2, ['S', 'SVJ', 'Ultimae']),
    ]),
  ]),

  make('aston-martin', 'Aston Martin', 2, [
    m('vantage', 'Vantage', 'LUXURY', 2012, null, [
      p('PETROL', 'AUTOMATIC', 3982, 2, ['Coupe', 'Roadster']),
    ]),
    m('db11', 'DB11', 'LUXURY', 2017, null, [p('PETROL', 'AUTOMATIC', 3982, 4, ['V8', 'V12'])]),
    m('dbx', 'DBX', 'SUV', 2020, null, [p('PETROL', 'AUTOMATIC', 3982, 5, ['Standard', '707'])]),
  ]),
];
