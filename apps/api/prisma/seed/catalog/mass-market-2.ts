/**
 * The rest of the volume market: the Japanese and Korean importers, the
 * Europeans who build here, and the four brands that have left India since
 * 2017 — Chevrolet, Ford, Datsun and Fiat.
 *
 * The departed brands matter more than their showroom presence suggests. A
 * marque that stopped selling in 2021 still has a decade of cars changing
 * hands, and those are exactly the listings a used-car marketplace exists for.
 */
import { m, make, p, type CatalogMake } from './schema.js';

export const MASS_MARKET_2: CatalogMake[] = [
  make('toyota', 'Toyota', 85, [
    m('etios', 'Etios', 'SEDAN', 2010, 2020, [
      p('PETROL', 'MANUAL', 1496, 5, ['J', 'G', 'V', 'VX', 'GD']),
      p('DIESEL', 'MANUAL', 1364, 5, ['JD', 'GD Diesel', 'VD', 'VXD']),
    ]),
    m('etios-liva', 'Etios Liva', 'HATCHBACK', 2011, 2020, [
      p('PETROL', 'MANUAL', 1197, 5, ['J', 'G', 'V', 'VX', 'GX']),
      p('DIESEL', 'MANUAL', 1364, 5, ['JD', 'GD', 'VD', 'VXD']),
    ]),
    m('etios-cross', 'Etios Cross', 'HATCHBACK', 2014, 2020, [
      p('PETROL', 'MANUAL', 1197, 5, ['G', 'V', 'X']),
      p('DIESEL', 'MANUAL', 1364, 5, ['GD', 'VD']),
    ]),
    m('glanza', 'Glanza', 'HATCHBACK', 2019, null, [
      p('PETROL', 'MANUAL', 1197, 5, ['E', 'S', 'G', 'V']),
      p('PETROL', 'AUTOMATIC', 1197, 5, ['G AMT', 'V AMT', 'G CVT', 'V CVT']),
      p('CNG', 'MANUAL', 1197, 5, ['S CNG']),
    ]),
    m('liva', 'Yaris', 'SEDAN', 2018, 2021, [
      p('PETROL', 'MANUAL', 1496, 5, ['J', 'G', 'V', 'VX']),
      p('PETROL', 'AUTOMATIC', 1496, 5, ['J CVT', 'G CVT', 'V CVT', 'VX CVT']),
    ]),
    m('corolla-altis', 'Corolla Altis', 'SEDAN', 2008, 2020, [
      p('PETROL', 'MANUAL', 1798, 5, ['J', 'G', 'GL', 'VL']),
      p('PETROL', 'AUTOMATIC', 1798, 5, ['G CVT', 'VL CVT']),
      p('DIESEL', 'MANUAL', 1364, 5, ['JD', 'GL Diesel', 'DG', 'D-4D J']),
    ]),
    m('camry', 'Camry', 'LUXURY', 2002, null, [
      p('PETROL', 'AUTOMATIC', 2494, 5, ['2.5 AT']),
      p('HYBRID', 'AUTOMATIC', 2487, 5, ['Hybrid', 'Hybrid Premium']),
    ]),
    m('innova', 'Innova', 'MUV', 2005, 2016, [
      p('DIESEL', 'MANUAL', 2494, 8, ['2.5 E', '2.5 G', '2.5 GX', '2.5 VX', '2.5 ZX']),
      p('PETROL', 'MANUAL', 1998, 8, ['2.0 G', '2.0 GX', '2.0 VX']),
    ]),
    m('innova-crysta', 'Innova Crysta', 'MUV', 2016, null, [
      p('DIESEL', 'MANUAL', 2393, 7, ['2.4 G', '2.4 GX', '2.4 VX', '2.4 ZX', '2.4 GX Plus']),
      p('DIESEL', 'AUTOMATIC', 2755, 7, ['2.8 GX AT', '2.8 VX AT', '2.8 ZX AT']),
      p('PETROL', 'MANUAL', 2694, 7, ['2.7 G', '2.7 GX', '2.7 VX']),
      p('PETROL', 'AUTOMATIC', 2694, 7, ['2.7 GX AT', '2.7 VX AT', '2.7 ZX AT']),
    ]),
    m('innova-hycross', 'Innova Hycross', 'MUV', 2023, null, [
      p('PETROL', 'AUTOMATIC', 1987, 8, ['G', 'GX', 'GX (O)']),
      p('HYBRID', 'AUTOMATIC', 1987, 7, ['VX Hybrid', 'ZX Hybrid', 'ZX (O) Hybrid']),
    ]),
    m('fortuner', 'Fortuner', 'SUV', 2009, null, [
      p('DIESEL', 'MANUAL', 2755, 7, ['2.8 4x2', '2.8 4x4']),
      p('DIESEL', 'AUTOMATIC', 2755, 7, [
        '2.8 4x2 AT',
        '2.8 4x4 AT',
        'Legender 4x2 AT',
        'Legender 4x4 AT',
      ]),
      p('PETROL', 'MANUAL', 2694, 7, ['2.7 4x2 Petrol']),
      p('PETROL', 'AUTOMATIC', 2694, 7, ['2.7 4x2 Petrol AT']),
      p('DIESEL', 'MANUAL', 2982, 7, ['3.0 4x2', '3.0 4x4']),
      p('DIESEL', 'AUTOMATIC', 2982, 7, ['3.0 4x4 AT']),
    ]),
    m('urban-cruiser', 'Urban Cruiser', 'SUV', 2020, 2022, [
      p('PETROL', 'MANUAL', 1462, 5, ['Mid', 'High', 'Premium']),
      p('PETROL', 'AUTOMATIC', 1462, 5, ['Mid AT', 'High AT', 'Premium AT']),
    ]),
    m('urban-cruiser-hyryder', 'Urban Cruiser Hyryder', 'SUV', 2022, null, [
      p('PETROL', 'MANUAL', 1462, 5, ['E', 'S', 'G']),
      p('PETROL', 'AUTOMATIC', 1462, 5, ['S AT', 'G AT', 'V AWD']),
      p('HYBRID', 'AUTOMATIC', 1490, 5, ['S Hybrid', 'G Hybrid', 'V Hybrid']),
      p('CNG', 'MANUAL', 1462, 5, ['S CNG', 'G CNG']),
    ]),
    m('urban-cruiser-taisor', 'Urban Cruiser Taisor', 'SUV', 2024, null, [
      p('PETROL', 'MANUAL', 1197, 5, ['E', 'S', 'S+']),
      p('PETROL', 'AUTOMATIC', 998, 5, ['G Turbo AT', 'V Turbo AT']),
      p('CNG', 'MANUAL', 1197, 5, ['S CNG']),
    ]),
    m('rumion', 'Rumion', 'MUV', 2023, null, [
      p('PETROL', 'MANUAL', 1462, 7, ['S', 'G', 'V']),
      p('PETROL', 'AUTOMATIC', 1462, 7, ['G AT', 'V AT']),
      p('CNG', 'MANUAL', 1462, 7, ['S CNG']),
    ]),
    m('vellfire', 'Vellfire', 'LUXURY', 2020, null, [
      p('HYBRID', 'AUTOMATIC', 2487, 7, ['Executive Lounge', 'VIP Lounge']),
    ]),
    m('land-cruiser', 'Land Cruiser', 'LUXURY', 2010, null, [
      p('DIESEL', 'AUTOMATIC', 4461, 7, ['LC200 VX', 'LC300 ZX']),
      p('DIESEL', 'AUTOMATIC', 2755, 7, ['LC250 ZX']),
    ]),
    m('land-cruiser-prado', 'Land Cruiser Prado', 'SUV', 2010, 2020, [
      p('DIESEL', 'AUTOMATIC', 2982, 7, ['VX-L AT']),
    ]),
    m('qualis', 'Qualis', 'MUV', 2000, 2005, [
      p('DIESEL', 'MANUAL', 2446, 9, ['FS B3', 'GS', 'GST']),
    ]),
  ]),

  make('kia', 'Kia', 80, [
    m('seltos', 'Seltos', 'SUV', 2019, null, [
      p('PETROL', 'MANUAL', 1497, 5, ['HTE', 'HTK', 'HTK+', 'HTX']),
      p('PETROL', 'AUTOMATIC', 1497, 5, ['HTK+ IVT', 'HTX IVT', 'HTX+ IVT']),
      p('PETROL', 'AUTOMATIC', 1482, 5, ['GTX+ DCT', 'X-Line DCT', 'HTX+ Turbo DCT']),
      p('DIESEL', 'MANUAL', 1493, 5, ['HTE Diesel', 'HTK Diesel', 'HTK+ Diesel', 'HTX Diesel']),
      p('DIESEL', 'AUTOMATIC', 1493, 5, ['HTX+ Diesel AT', 'GTX+ Diesel AT', 'X-Line Diesel AT']),
    ]),
    m('sonet', 'Sonet', 'SUV', 2020, null, [
      p('PETROL', 'MANUAL', 1197, 5, ['HTE', 'HTK', 'HTK+']),
      p('PETROL', 'AUTOMATIC', 998, 5, ['HTX Turbo DCT', 'GTX+ Turbo DCT', 'X-Line DCT']),
      p('PETROL', 'MANUAL', 998, 5, ['HTX Turbo iMT', 'GTX+ Turbo iMT']),
      p('DIESEL', 'MANUAL', 1493, 5, ['HTE Diesel', 'HTK Diesel', 'HTK+ Diesel', 'HTX Diesel']),
      p('DIESEL', 'AUTOMATIC', 1493, 5, ['HTX+ Diesel AT', 'GTX+ Diesel AT']),
    ]),
    m('syros', 'Syros', 'SUV', 2025, null, [
      p('PETROL', 'MANUAL', 998, 5, ['HTK', 'HTK+', 'HTX']),
      p('PETROL', 'AUTOMATIC', 998, 5, ['HTX+ DCT', 'HTX (O) DCT']),
      p('DIESEL', 'MANUAL', 1493, 5, ['HTK Diesel', 'HTX Diesel']),
    ]),
    m('carens', 'Carens', 'MUV', 2022, null, [
      p('PETROL', 'MANUAL', 1497, 7, ['Premium', 'Prestige', 'Prestige Plus']),
      p('PETROL', 'AUTOMATIC', 1482, 7, ['Luxury Turbo DCT', 'Luxury Plus Turbo DCT']),
      p('DIESEL', 'MANUAL', 1493, 7, ['Premium Diesel', 'Prestige Diesel', 'Luxury Diesel']),
      p('DIESEL', 'AUTOMATIC', 1493, 7, ['Luxury Plus Diesel AT']),
    ]),
    m('carnival', 'Carnival', 'MUV', 2020, null, [
      p('DIESEL', 'AUTOMATIC', 2199, 7, ['Premium', 'Prestige', 'Limousine', 'Limousine Plus']),
    ]),
    m('ev6', 'EV6', 'SUV', 2022, null, [
      p('ELECTRIC', 'AUTOMATIC', null, 5, ['GT Line RWD', 'GT Line AWD']),
    ]),
    m('ev9', 'EV9', 'SUV', 2024, null, [p('ELECTRIC', 'AUTOMATIC', null, 6, ['GT Line AWD'])]),
  ]),

  make('honda', 'Honda', 78, [
    m('brio', 'Brio', 'HATCHBACK', 2011, 2018, [
      p('PETROL', 'MANUAL', 1198, 5, ['E', 'S', 'V', 'VX', 'S (O)']),
      p('PETROL', 'AUTOMATIC', 1198, 5, ['S AT', 'V AT', 'VX AT']),
    ]),
    m('jazz', 'Jazz', 'HATCHBACK', 2009, 2022, [
      p('PETROL', 'MANUAL', 1199, 5, ['E', 'S', 'V', 'VX', 'ZX']),
      p('PETROL', 'AUTOMATIC', 1199, 5, ['S CVT', 'V CVT', 'VX CVT', 'ZX CVT']),
      p('DIESEL', 'MANUAL', 1498, 5, ['S Diesel', 'V Diesel', 'VX Diesel']),
    ]),
    m('amaze', 'Amaze', 'SEDAN', 2013, null, [
      p('PETROL', 'MANUAL', 1199, 5, ['E', 'S', 'V', 'VX', 'ZX']),
      p('PETROL', 'AUTOMATIC', 1199, 5, ['S CVT', 'V CVT', 'VX CVT', 'ZX CVT']),
      p('DIESEL', 'MANUAL', 1498, 5, ['E Diesel', 'S Diesel', 'V Diesel', 'VX Diesel']),
      p('DIESEL', 'AUTOMATIC', 1498, 5, ['S Diesel CVT', 'V Diesel CVT']),
    ]),
    m('city', 'City', 'SEDAN', 1998, null, [
      p('PETROL', 'MANUAL', 1497, 5, ['E', 'S', 'V', 'VX', 'ZX', 'SV']),
      p('PETROL', 'AUTOMATIC', 1497, 5, ['V CVT', 'VX CVT', 'ZX CVT', 'S AT', 'V AT']),
      p('DIESEL', 'MANUAL', 1498, 5, [
        'E Diesel',
        'S Diesel',
        'V Diesel',
        'VX Diesel',
        'ZX Diesel',
      ]),
      p('HYBRID', 'AUTOMATIC', 1498, 5, ['e:HEV ZX']),
    ]),
    m('civic', 'Civic', 'SEDAN', 2006, 2020, [
      p('PETROL', 'MANUAL', 1799, 5, ['V MT', 'VX MT']),
      p('PETROL', 'AUTOMATIC', 1799, 5, ['V CVT', 'VX CVT', 'ZX CVT', '1.8 S AT']),
      p('DIESEL', 'MANUAL', 1597, 5, ['V Diesel', 'VX Diesel', 'ZX Diesel']),
    ]),
    m('accord', 'Accord', 'LUXURY', 2001, 2020, [
      p('PETROL', 'AUTOMATIC', 2354, 5, ['2.4 AT', 'VTi-L']),
      p('HYBRID', 'AUTOMATIC', 1993, 5, ['Hybrid']),
    ]),
    m('wr-v', 'WR-V', 'SUV', 2017, 2023, [
      p('PETROL', 'MANUAL', 1199, 5, ['S', 'VX', 'SV', 'Alive Edition']),
      p('DIESEL', 'MANUAL', 1498, 5, ['S Diesel', 'VX Diesel', 'SV Diesel']),
    ]),
    m('br-v', 'BR-V', 'MUV', 2016, 2020, [
      p('PETROL', 'MANUAL', 1497, 7, ['E', 'S', 'V', 'VX']),
      p('PETROL', 'AUTOMATIC', 1497, 7, ['V CVT', 'VX CVT']),
      p('DIESEL', 'MANUAL', 1498, 7, ['E Diesel', 'S Diesel', 'V Diesel', 'VX Diesel']),
    ]),
    m('cr-v', 'CR-V', 'SUV', 2003, 2020, [
      p('PETROL', 'AUTOMATIC', 1997, 5, ['2.0 AT', '2.0 2WD AT']),
      p('PETROL', 'AUTOMATIC', 2354, 5, ['2.4 AT AWD']),
      p('DIESEL', 'AUTOMATIC', 1597, 7, ['1.6 Diesel AT AWD']),
    ]),
    m('elevate', 'Elevate', 'SUV', 2023, null, [
      p('PETROL', 'MANUAL', 1498, 5, ['SV', 'V', 'VX', 'ZX']),
      p('PETROL', 'AUTOMATIC', 1498, 5, ['V CVT', 'VX CVT', 'ZX CVT']),
    ]),
    m('mobilio', 'Mobilio', 'MUV', 2014, 2017, [
      p('PETROL', 'MANUAL', 1497, 7, ['E', 'S', 'V', 'RS']),
      p('DIESEL', 'MANUAL', 1498, 7, ['E Diesel', 'S Diesel', 'V Diesel', 'RS Diesel']),
    ]),
  ]),

  make('mg', 'MG', 70, [
    m('hector', 'Hector', 'SUV', 2019, null, [
      p('PETROL', 'MANUAL', 1451, 5, ['Style', 'Super', 'Smart', 'Sharp']),
      p('PETROL', 'AUTOMATIC', 1451, 5, ['Smart DCT', 'Sharp DCT', 'Savvy DCT', 'Sharp Pro CVT']),
      p('DIESEL', 'MANUAL', 1956, 5, [
        'Style Diesel',
        'Super Diesel',
        'Smart Diesel',
        'Sharp Diesel',
      ]),
      p('HYBRID', 'MANUAL', 1451, 5, ['Super Hybrid', 'Smart Hybrid']),
    ]),
    m('hector-plus', 'Hector Plus', 'SUV', 2020, null, [
      p('PETROL', 'MANUAL', 1451, 6, ['Style', 'Super', 'Smart']),
      p('PETROL', 'AUTOMATIC', 1451, 7, ['Smart DCT', 'Sharp DCT', 'Savvy Pro CVT']),
      p('DIESEL', 'MANUAL', 1956, 7, ['Super Diesel', 'Smart Diesel', 'Sharp Diesel']),
    ]),
    m('astor', 'Astor', 'SUV', 2021, null, [
      p('PETROL', 'MANUAL', 1498, 5, ['Style', 'Super', 'Smart']),
      p('PETROL', 'AUTOMATIC', 1498, 5, ['Super CVT', 'Smart CVT', 'Sharp CVT']),
      p('PETROL', 'AUTOMATIC', 1349, 5, ['Savvy Turbo AT', 'Sharp Turbo AT']),
    ]),
    m('gloster', 'Gloster', 'SUV', 2020, null, [
      p('DIESEL', 'AUTOMATIC', 1996, 7, ['Super', 'Smart', 'Sharp', 'Savvy 4x4', 'Blackstorm']),
    ]),
    m('zs-ev', 'ZS EV', 'SUV', 2020, null, [
      p('ELECTRIC', 'AUTOMATIC', null, 5, ['Excite', 'Exclusive', 'Essence']),
    ]),
    m('comet-ev', 'Comet EV', 'HATCHBACK', 2023, null, [
      p('ELECTRIC', 'AUTOMATIC', null, 4, ['Pace', 'Play', 'Plush']),
    ]),
    m('windsor-ev', 'Windsor EV', 'SUV', 2024, null, [
      p('ELECTRIC', 'AUTOMATIC', null, 5, ['Excite', 'Exclusive', 'Essence']),
    ]),
  ]),

  make('renault', 'Renault', 65, [
    m('kwid', 'Kwid', 'HATCHBACK', 2015, null, [
      p('PETROL', 'MANUAL', 799, 5, ['STD', 'RXE', 'RXL', 'RXT']),
      p('PETROL', 'MANUAL', 999, 5, ['RXL 1.0', 'RXT 1.0', 'Climber 1.0']),
      p('PETROL', 'AUTOMATIC', 999, 5, ['RXL AMT', 'RXT AMT', 'Climber AMT']),
    ]),
    m('duster', 'Duster', 'SUV', 2012, 2022, [
      p('DIESEL', 'MANUAL', 1461, 5, ['RxE', 'RxL', 'RxZ', 'RxZ AWD', '110 PS RxZ']),
      p('PETROL', 'MANUAL', 1498, 5, ['RxE Petrol', 'RxS Petrol', 'RxZ Petrol']),
      p('PETROL', 'AUTOMATIC', 1330, 5, ['RxZ Turbo CVT', 'RxS Turbo CVT']),
      p('DIESEL', 'AUTOMATIC', 1461, 5, ['RxS AMT', 'RxZ AMT']),
    ]),
    m('captur', 'Captur', 'SUV', 2017, 2020, [
      p('PETROL', 'MANUAL', 1498, 5, ['RxE', 'RxL', 'RxT', 'Platine']),
      p('DIESEL', 'MANUAL', 1461, 5, ['RxE Diesel', 'RxL Diesel', 'RxT Diesel', 'Platine Diesel']),
    ]),
    m('triber', 'Triber', 'MUV', 2019, null, [
      p('PETROL', 'MANUAL', 999, 7, ['RxE', 'RxL', 'RxT', 'RxZ']),
      p('PETROL', 'AUTOMATIC', 999, 7, ['RxL AMT', 'RxT AMT', 'RxZ AMT']),
    ]),
    m('kiger', 'Kiger', 'SUV', 2021, null, [
      p('PETROL', 'MANUAL', 999, 5, ['RxE', 'RxL', 'RxT', 'RxZ']),
      p('PETROL', 'AUTOMATIC', 999, 5, ['RxL AMT', 'RxT AMT', 'RxZ CVT', 'RxT Turbo CVT']),
    ]),
    m('lodgy', 'Lodgy', 'MUV', 2015, 2019, [
      p('DIESEL', 'MANUAL', 1461, 8, ['RxE', 'RxL', 'RxZ', 'Stepway RxZ']),
    ]),
    m('scala', 'Scala', 'SEDAN', 2012, 2017, [
      p('PETROL', 'MANUAL', 1498, 5, ['RxE', 'RxL', 'RxZ']),
      p('DIESEL', 'MANUAL', 1461, 5, ['RxE Diesel', 'RxL Diesel', 'RxZ Diesel']),
    ]),
    m('pulse', 'Pulse', 'HATCHBACK', 2012, 2017, [
      p('PETROL', 'MANUAL', 1198, 5, ['RxE', 'RxL', 'RxZ']),
      p('DIESEL', 'MANUAL', 1461, 5, ['RxL Diesel', 'RxZ Diesel']),
    ]),
    m('fluence', 'Fluence', 'SEDAN', 2011, 2016, [
      p('PETROL', 'MANUAL', 1997, 5, ['E4 Petrol']),
      p('DIESEL', 'MANUAL', 1461, 5, ['E2 Diesel', 'E4 Diesel']),
    ]),
    m('koleos', 'Koleos', 'SUV', 2011, 2015, [
      p('DIESEL', 'AUTOMATIC', 1995, 5, ['4x2 AT', '4x4 AT']),
    ]),
  ]),

  make('volkswagen', 'Volkswagen', 62, [
    m('polo', 'Polo', 'HATCHBACK', 2010, 2022, [
      p('PETROL', 'MANUAL', 999, 5, ['Trendline', 'Comfortline', 'Highline', 'Highline Plus']),
      p('PETROL', 'AUTOMATIC', 999, 5, ['Comfortline AT', 'Highline Plus AT']),
      p('PETROL', 'MANUAL', 1198, 5, ['GT TSI', '1.2 Highline']),
      p('PETROL', 'AUTOMATIC', 1198, 5, ['GT TSI DSG']),
      p('DIESEL', 'MANUAL', 1498, 5, [
        'Trendline Diesel',
        'Comfortline Diesel',
        'Highline Diesel',
        'GT TDI',
      ]),
    ]),
    m('vento', 'Vento', 'SEDAN', 2010, 2022, [
      p('PETROL', 'MANUAL', 999, 5, ['Trendline', 'Comfortline', 'Highline', 'Highline Plus']),
      p('PETROL', 'AUTOMATIC', 999, 5, ['Comfortline AT', 'Highline Plus AT', 'GT TSI DSG']),
      p('DIESEL', 'MANUAL', 1498, 5, ['Trendline Diesel', 'Comfortline Diesel', 'Highline Diesel']),
      p('DIESEL', 'AUTOMATIC', 1498, 5, ['Highline Diesel AT']),
    ]),
    m('ameo', 'Ameo', 'SEDAN', 2016, 2020, [
      p('PETROL', 'MANUAL', 1198, 5, ['Trendline', 'Comfortline', 'Highline']),
      p('DIESEL', 'MANUAL', 1498, 5, ['Trendline Diesel', 'Comfortline Diesel', 'Highline Diesel']),
      p('DIESEL', 'AUTOMATIC', 1498, 5, ['Highline Plus DSG']),
    ]),
    m('virtus', 'Virtus', 'SEDAN', 2022, null, [
      p('PETROL', 'MANUAL', 999, 5, ['Comfortline', 'Highline', 'Topline']),
      p('PETROL', 'AUTOMATIC', 999, 5, ['Highline AT', 'Topline AT']),
      p('PETROL', 'AUTOMATIC', 1498, 5, ['GT Plus DSG', 'GT Plus Sport DSG']),
    ]),
    m('taigun', 'Taigun', 'SUV', 2021, null, [
      p('PETROL', 'MANUAL', 999, 5, ['Comfortline', 'Highline', 'Topline']),
      p('PETROL', 'AUTOMATIC', 999, 5, ['Highline AT', 'Topline AT']),
      p('PETROL', 'AUTOMATIC', 1498, 5, ['GT Plus DSG', 'GT Plus Sport DSG']),
    ]),
    m('tiguan', 'Tiguan', 'SUV', 2017, null, [
      p('DIESEL', 'AUTOMATIC', 1968, 5, ['Comfortline', 'Highline']),
      p('PETROL', 'AUTOMATIC', 1984, 5, ['Elegance', 'Allspace']),
    ]),
    m('jetta', 'Jetta', 'SEDAN', 2011, 2018, [
      p('DIESEL', 'MANUAL', 1968, 5, ['Trendline', 'Comfortline', 'Highline']),
      p('DIESEL', 'AUTOMATIC', 1968, 5, ['Comfortline AT', 'Highline AT']),
      p('PETROL', 'MANUAL', 1390, 5, ['Trendline Petrol']),
    ]),
    m('passat', 'Passat', 'LUXURY', 2011, 2020, [
      p('DIESEL', 'AUTOMATIC', 1968, 5, ['Comfortline', 'Highline', 'GT']),
    ]),
    m('beetle', 'Beetle', 'LUXURY', 2016, 2019, [p('PETROL', 'AUTOMATIC', 1390, 4, ['Base'])]),
    m('t-roc', 'T-Roc', 'SUV', 2020, 2022, [p('PETROL', 'AUTOMATIC', 1498, 5, ['Base'])]),
  ]),

  make('skoda', 'Skoda', 60, [
    m('fabia', 'Fabia', 'HATCHBACK', 2008, 2013, [
      p('PETROL', 'MANUAL', 1198, 5, ['Classic', 'Ambiente', 'Elegance']),
      p('DIESEL', 'MANUAL', 1198, 5, ['Ambiente TDI', 'Elegance TDI']),
    ]),
    m('rapid', 'Rapid', 'SEDAN', 2011, 2021, [
      p('PETROL', 'MANUAL', 1598, 5, ['Active', 'Ambition', 'Elegance', 'Style']),
      p('PETROL', 'MANUAL', 999, 5, ['Rider', 'Ambition TSI', 'Style TSI', 'Monte Carlo']),
      p('PETROL', 'AUTOMATIC', 999, 5, ['Ambition TSI AT', 'Style TSI AT', 'Monte Carlo AT']),
      p('DIESEL', 'MANUAL', 1498, 5, ['Active TDI', 'Ambition TDI', 'Style TDI']),
      p('DIESEL', 'AUTOMATIC', 1498, 5, ['Style TDI AT']),
    ]),
    m('slavia', 'Slavia', 'SEDAN', 2022, null, [
      p('PETROL', 'MANUAL', 999, 5, ['Active', 'Ambition', 'Style']),
      p('PETROL', 'AUTOMATIC', 999, 5, ['Ambition 1.0 AT', 'Style 1.0 AT']),
      p('PETROL', 'MANUAL', 1498, 5, ['Style 1.5 MT', 'Monte Carlo 1.5']),
      p('PETROL', 'AUTOMATIC', 1498, 5, ['Style 1.5 DSG', 'Monte Carlo DSG']),
    ]),
    m('octavia', 'Octavia', 'SEDAN', 2001, 2022, [
      p('PETROL', 'AUTOMATIC', 1984, 5, ['Style', 'Laurin & Klement', 'vRS 245']),
      p('PETROL', 'MANUAL', 1395, 5, ['Ambition TSI', 'Style TSI']),
      p('DIESEL', 'MANUAL', 1968, 5, ['Ambition TDI', 'Style TDI', 'L&K TDI']),
      p('DIESEL', 'AUTOMATIC', 1968, 5, ['Style TDI AT', 'L&K TDI AT']),
    ]),
    m('superb', 'Superb', 'LUXURY', 2009, null, [
      p('PETROL', 'AUTOMATIC', 1984, 5, ['Style', 'Sportline', 'Laurin & Klement']),
      p('DIESEL', 'AUTOMATIC', 1968, 5, ['Style TDI', 'L&K TDI']),
    ]),
    m('kushaq', 'Kushaq', 'SUV', 2021, null, [
      p('PETROL', 'MANUAL', 999, 5, ['Active', 'Ambition', 'Style']),
      p('PETROL', 'AUTOMATIC', 999, 5, ['Ambition 1.0 AT', 'Style 1.0 AT']),
      p('PETROL', 'MANUAL', 1498, 5, ['Style 1.5 MT', 'Monte Carlo 1.5']),
      p('PETROL', 'AUTOMATIC', 1498, 5, ['Style 1.5 DSG', 'Monte Carlo DSG']),
    ]),
    m('kylaq', 'Kylaq', 'SUV', 2025, null, [
      p('PETROL', 'MANUAL', 999, 5, ['Classic', 'Signature', 'Signature+', 'Prestige']),
      p('PETROL', 'AUTOMATIC', 999, 5, ['Signature+ AT', 'Prestige AT']),
    ]),
    m('kodiaq', 'Kodiaq', 'SUV', 2017, null, [
      p('DIESEL', 'AUTOMATIC', 1968, 7, ['Style 4x4', 'L&K 4x4', 'Scout']),
      p('PETROL', 'AUTOMATIC', 1984, 7, ['Style TSI', 'L&K TSI', 'Sportline']),
    ]),
    m('yeti', 'Yeti', 'SUV', 2010, 2017, [
      p('DIESEL', 'MANUAL', 1968, 5, ['Ambition 4x2', 'Elegance 4x4', 'Active 4x2']),
    ]),
    m('laura', 'Laura', 'SEDAN', 2005, 2013, [
      p('DIESEL', 'MANUAL', 1968, 5, ['Ambiente TDI', 'Elegance TDI']),
      p('DIESEL', 'AUTOMATIC', 1968, 5, ['Elegance TDI AT', 'L&K DSG']),
    ]),
  ]),

  make('nissan', 'Nissan', 55, [
    m('micra', 'Micra', 'HATCHBACK', 2010, 2020, [
      p('PETROL', 'MANUAL', 1198, 5, ['XE', 'XL', 'XV', 'XV CVT']),
      p('PETROL', 'AUTOMATIC', 1198, 5, ['XL CVT', 'XV CVT Petrol']),
      p('DIESEL', 'MANUAL', 1461, 5, ['XE Diesel', 'XL Diesel', 'XV Diesel']),
    ]),
    m('sunny', 'Sunny', 'SEDAN', 2011, 2019, [
      p('PETROL', 'MANUAL', 1498, 5, ['XE', 'XL', 'XV']),
      p('PETROL', 'AUTOMATIC', 1498, 5, ['XL CVT', 'XV CVT']),
      p('DIESEL', 'MANUAL', 1461, 5, ['XE Diesel', 'XL Diesel', 'XV Diesel']),
    ]),
    m('terrano', 'Terrano', 'SUV', 2013, 2020, [
      p('DIESEL', 'MANUAL', 1461, 5, ['XE', 'XL', 'XV', 'XV Premium']),
      p('DIESEL', 'AUTOMATIC', 1461, 5, ['XL AMT', 'XV AMT']),
      p('PETROL', 'MANUAL', 1598, 5, ['XE Petrol', 'XL Petrol', 'XV Petrol']),
    ]),
    m('kicks', 'Kicks', 'SUV', 2019, 2022, [
      p('PETROL', 'MANUAL', 1498, 5, ['XL', 'XV', 'XV Premium']),
      p('PETROL', 'AUTOMATIC', 1330, 5, ['XV Turbo CVT', 'XV Premium Turbo CVT']),
      p('DIESEL', 'MANUAL', 1461, 5, ['XL Diesel', 'XV Diesel', 'XV Premium Diesel']),
    ]),
    m('magnite', 'Magnite', 'SUV', 2020, null, [
      p('PETROL', 'MANUAL', 999, 5, ['XE', 'XL', 'XV', 'XV Premium']),
      p('PETROL', 'AUTOMATIC', 999, 5, ['XL Turbo CVT', 'XV Turbo CVT', 'XV Premium Turbo CVT']),
    ]),
    m('evalia', 'Evalia', 'MUV', 2012, 2016, [p('DIESEL', 'MANUAL', 1461, 7, ['XE', 'XL', 'XV'])]),
    m('gt-r', 'GT-R', 'LUXURY', 2016, 2020, [
      p('PETROL', 'AUTOMATIC', 3799, 4, ['Premium Edition']),
    ]),
    m('x-trail', 'X-Trail', 'SUV', 2005, 2014, [
      p('DIESEL', 'MANUAL', 1995, 5, ['SLX MT']),
      p('DIESEL', 'AUTOMATIC', 1995, 5, ['SLX AT']),
    ]),
  ]),
];
