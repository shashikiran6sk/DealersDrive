/**
 * The volume brands — roughly 90% of what a Tamil Nadu used-car yard actually
 * holds. Models discontinued years ago are here on purpose: a 2012 Ritz or a
 * 2014 Sail is a car somebody is selling this week, and a catalogue that only
 * knows what is on sale today cannot list it.
 *
 * `yearTo` is the last model year sold new. `null` means still on sale.
 */
import { m, make, p, type CatalogMake } from './schema.js';

export const MASS_MARKET: CatalogMake[] = [
  make('maruti-suzuki', 'Maruti Suzuki', 100, [
    m('alto-800', 'Alto 800', 'HATCHBACK', 2012, 2022, [
      p('PETROL', 'MANUAL', 796, 5, ['Std', 'LXi', 'VXi', 'VXi+', 'LXi (O)', 'VXi (O)']),
      p('CNG', 'MANUAL', 796, 5, ['LXi CNG', 'VXi CNG']),
    ]),
    m('alto-k10', 'Alto K10', 'HATCHBACK', 2010, null, [
      p('PETROL', 'MANUAL', 998, 5, ['Std', 'LXi', 'VXi', 'VXi+']),
      p('PETROL', 'AUTOMATIC', 998, 5, ['VXi AGS', 'VXi+ AGS']),
      p('CNG', 'MANUAL', 998, 5, ['LXi CNG', 'VXi CNG']),
    ]),
    m('alto', 'Alto', 'HATCHBACK', 2000, 2012, [
      p('PETROL', 'MANUAL', 796, 5, ['Std', 'LX', 'LXi', 'VX']),
      p('LPG', 'MANUAL', 796, 5, ['LX LPG']),
    ]),
    m('a-star', 'A-Star', 'HATCHBACK', 2008, 2014, [
      p('PETROL', 'MANUAL', 998, 5, ['Lxi', 'Vxi', 'Zxi']),
      p('PETROL', 'AUTOMATIC', 998, 5, ['Vxi AT']),
    ]),
    m('zen-estilo', 'Zen Estilo', 'HATCHBACK', 2006, 2013, [
      p('PETROL', 'MANUAL', 998, 5, ['LX', 'LXi', 'VXi', 'VXi ABS']),
      p('LPG', 'MANUAL', 998, 5, ['LX LPG']),
    ]),
    m('ritz', 'Ritz', 'HATCHBACK', 2009, 2017, [
      p('PETROL', 'MANUAL', 1197, 5, ['LXi', 'VXi', 'ZXi']),
      p('PETROL', 'AUTOMATIC', 1197, 5, ['VXi AT']),
      p('DIESEL', 'MANUAL', 1248, 5, ['LDi', 'VDi', 'ZDi']),
    ]),
    m('wagon-r', 'Wagon R', 'HATCHBACK', 2010, null, [
      p('PETROL', 'MANUAL', 998, 5, ['LXi', 'VXi', 'ZXi', 'LXi (O)', 'VXi (O)', 'ZXi+']),
      p('PETROL', 'AUTOMATIC', 1197, 5, ['VXi AGS', 'ZXi AGS', 'ZXi+ AGS']),
      p('PETROL', 'MANUAL', 1197, 5, ['ZXi 1.2', 'ZXi+ 1.2']),
      p('CNG', 'MANUAL', 998, 5, ['LXi CNG', 'VXi CNG']),
    ]),
    m('celerio', 'Celerio', 'HATCHBACK', 2014, null, [
      p('PETROL', 'MANUAL', 998, 5, ['LXi', 'VXi', 'ZXi', 'ZXi+', 'VXi (O)']),
      p('PETROL', 'AUTOMATIC', 998, 5, ['VXi AMT', 'ZXi AMT', 'ZXi+ AMT']),
      p('CNG', 'MANUAL', 998, 5, ['VXi CNG']),
      p('DIESEL', 'MANUAL', 793, 5, ['VDi', 'ZDi']),
    ]),
    m('celerio-x', 'Celerio X', 'HATCHBACK', 2017, 2021, [
      p('PETROL', 'MANUAL', 998, 5, ['VXi', 'ZXi', 'ZXi+']),
      p('PETROL', 'AUTOMATIC', 998, 5, ['VXi AMT', 'ZXi AMT', 'ZXi+ AMT']),
    ]),
    m('swift', 'Swift', 'HATCHBACK', 2005, null, [
      p('PETROL', 'MANUAL', 1197, 5, ['LXi', 'VXi', 'ZXi', 'ZXi+', 'VXi (O)', 'ZXi (O)']),
      p('PETROL', 'AUTOMATIC', 1197, 5, ['VXi AMT', 'ZXi AMT', 'ZXi+ AMT', 'ZXi+ AGS']),
      p('DIESEL', 'MANUAL', 1248, 5, ['LDi', 'VDi', 'ZDi', 'ZDi+']),
      p('DIESEL', 'AUTOMATIC', 1248, 5, ['VDi AMT', 'ZDi+ AMT']),
      p('CNG', 'MANUAL', 1197, 5, ['VXi CNG']),
    ]),
    m('dzire', 'Dzire', 'SEDAN', 2008, null, [
      p('PETROL', 'MANUAL', 1197, 5, ['LXi', 'VXi', 'ZXi', 'ZXi+']),
      p('PETROL', 'AUTOMATIC', 1197, 5, ['VXi AMT', 'ZXi AMT', 'ZXi+ AMT']),
      p('DIESEL', 'MANUAL', 1248, 5, ['LDi', 'VDi', 'ZDi', 'ZDi+']),
      p('DIESEL', 'AUTOMATIC', 1248, 5, ['VDi AMT', 'ZDi+ AMT']),
      p('CNG', 'MANUAL', 1197, 5, ['VXi CNG', 'ZXi CNG']),
    ]),
    m('swift-dzire', 'Swift Dzire', 'SEDAN', 2008, 2017, [
      p('PETROL', 'MANUAL', 1197, 5, ['LXi', 'VXi', 'ZXi']),
      p('DIESEL', 'MANUAL', 1248, 5, ['LDi', 'VDi', 'ZDi']),
    ]),
    m('dzire-tour', 'Dzire Tour S', 'SEDAN', 2017, null, [
      p('PETROL', 'MANUAL', 1197, 5, ['Tour S']),
      p('CNG', 'MANUAL', 1197, 5, ['Tour S CNG']),
      p('DIESEL', 'MANUAL', 1248, 5, ['Tour S Diesel']),
    ]),
    m('baleno', 'Baleno', 'HATCHBACK', 2015, null, [
      p('PETROL', 'MANUAL', 1197, 5, ['Sigma', 'Delta', 'Zeta', 'Alpha']),
      p('PETROL', 'AUTOMATIC', 1197, 5, [
        'Delta CVT',
        'Zeta CVT',
        'Alpha CVT',
        'Zeta AT',
        'Alpha AMT',
      ]),
      p('DIESEL', 'MANUAL', 1248, 5, [
        'Sigma Diesel',
        'Delta Diesel',
        'Zeta Diesel',
        'Alpha Diesel',
      ]),
      p('CNG', 'MANUAL', 1197, 5, ['Delta CNG']),
    ]),
    m('baleno-rs', 'Baleno RS', 'HATCHBACK', 2017, 2020, [
      p('PETROL', 'MANUAL', 998, 5, ['RS 1.0']),
    ]),
    m('ignis', 'Ignis', 'HATCHBACK', 2017, null, [
      p('PETROL', 'MANUAL', 1197, 5, ['Sigma', 'Delta', 'Zeta', 'Alpha']),
      p('PETROL', 'AUTOMATIC', 1197, 5, ['Delta AMT', 'Zeta AMT', 'Alpha AMT']),
      p('DIESEL', 'MANUAL', 1248, 5, ['Sigma Diesel', 'Delta Diesel', 'Zeta Diesel']),
    ]),
    m('s-presso', 'S-Presso', 'HATCHBACK', 2019, null, [
      p('PETROL', 'MANUAL', 998, 5, ['Std', 'LXi', 'VXi', 'VXi+']),
      p('PETROL', 'AUTOMATIC', 998, 5, ['VXi AGS', 'VXi+ AGS']),
      p('CNG', 'MANUAL', 998, 5, ['LXi CNG', 'VXi CNG']),
    ]),
    m('eeco', 'Eeco', 'MUV', 2010, null, [
      p('PETROL', 'MANUAL', 1196, 7, ['5 Seater Std', '5 Seater AC', '7 Seater Std', 'Tour V']),
      p('CNG', 'MANUAL', 1196, 5, ['5 Seater CNG', 'Tour V CNG']),
    ]),
    m('ertiga', 'Ertiga', 'MUV', 2012, null, [
      p('PETROL', 'MANUAL', 1462, 7, ['LXi', 'VXi', 'ZXi', 'ZXi+']),
      p('PETROL', 'AUTOMATIC', 1462, 7, ['VXi AT', 'ZXi AT', 'ZXi+ AT']),
      p('DIESEL', 'MANUAL', 1248, 7, ['LDi', 'VDi', 'ZDi', 'ZDi+']),
      p('CNG', 'MANUAL', 1462, 7, ['LXi CNG', 'VXi CNG', 'ZXi CNG']),
    ]),
    m('xl6', 'XL6', 'MUV', 2019, null, [
      p('PETROL', 'MANUAL', 1462, 6, ['Zeta', 'Alpha']),
      p('PETROL', 'AUTOMATIC', 1462, 6, ['Zeta AT', 'Alpha AT', 'Alpha+ AT']),
      p('CNG', 'MANUAL', 1462, 6, ['Zeta CNG']),
    ]),
    m('invicto', 'Invicto', 'MUV', 2023, null, [
      p('HYBRID', 'AUTOMATIC', 1987, 7, ['Zeta+ 7 STR', 'Alpha+ 7 STR', 'Alpha+ 8 STR']),
    ]),
    m('ciaz', 'Ciaz', 'SEDAN', 2014, null, [
      p('PETROL', 'MANUAL', 1462, 5, ['Sigma', 'Delta', 'Zeta', 'Alpha']),
      p('PETROL', 'AUTOMATIC', 1462, 5, ['Delta AT', 'Zeta AT', 'Alpha AT']),
      p('DIESEL', 'MANUAL', 1248, 5, [
        'Sigma Diesel',
        'Delta Diesel',
        'Zeta Diesel',
        'Alpha Diesel',
      ]),
    ]),
    m('sx4', 'SX4', 'SEDAN', 2007, 2014, [
      p('PETROL', 'MANUAL', 1586, 5, ['VXi', 'ZXi']),
      p('DIESEL', 'MANUAL', 1248, 5, ['VDi', 'ZDi']),
    ]),
    m('kizashi', 'Kizashi', 'SEDAN', 2011, 2014, [
      p('PETROL', 'MANUAL', 2393, 5, ['MT']),
      p('PETROL', 'AUTOMATIC', 2393, 5, ['CVT', 'AT AWD']),
    ]),
    m('vitara-brezza', 'Vitara Brezza', 'SUV', 2016, 2022, [
      p('DIESEL', 'MANUAL', 1248, 5, ['LDi', 'VDi', 'ZDi', 'ZDi+']),
      p('PETROL', 'MANUAL', 1462, 5, ['LXi', 'VXi', 'ZXi', 'ZXi+']),
      p('PETROL', 'AUTOMATIC', 1462, 5, ['VXi AT', 'ZXi AT', 'ZXi+ AT']),
    ]),
    m('brezza', 'Brezza', 'SUV', 2022, null, [
      p('PETROL', 'MANUAL', 1462, 5, ['LXi', 'VXi', 'ZXi', 'ZXi+']),
      p('PETROL', 'AUTOMATIC', 1462, 5, ['VXi AT', 'ZXi AT', 'ZXi+ AT', 'ZXi+ Dual Tone AT']),
      p('CNG', 'MANUAL', 1462, 5, ['LXi CNG', 'VXi CNG', 'ZXi CNG']),
    ]),
    m('s-cross', 'S-Cross', 'SUV', 2015, 2022, [
      p('DIESEL', 'MANUAL', 1248, 5, ['Sigma', 'Delta', 'Zeta', 'Alpha']),
      p('DIESEL', 'MANUAL', 1598, 5, ['Alpha 1.6']),
      p('PETROL', 'MANUAL', 1462, 5, [
        'Sigma Petrol',
        'Delta Petrol',
        'Zeta Petrol',
        'Alpha Petrol',
      ]),
      p('PETROL', 'AUTOMATIC', 1462, 5, ['Zeta AT', 'Alpha AT']),
    ]),
    m('grand-vitara', 'Grand Vitara', 'SUV', 2022, null, [
      p('PETROL', 'MANUAL', 1462, 5, ['Sigma', 'Delta', 'Zeta', 'Alpha']),
      p('PETROL', 'AUTOMATIC', 1462, 5, ['Delta AT', 'Zeta AT', 'Alpha AT', 'Alpha AWD']),
      p('HYBRID', 'AUTOMATIC', 1490, 5, ['Zeta+ Hybrid', 'Alpha+ Hybrid']),
      p('CNG', 'MANUAL', 1462, 5, ['Delta CNG', 'Zeta CNG']),
    ]),
    m('grand-vitara-old', 'Grand Vitara (2007-2015)', 'SUV', 2007, 2015, [
      p('PETROL', 'AUTOMATIC', 2393, 5, ['2.4 AT']),
      p('PETROL', 'MANUAL', 2393, 5, ['2.4 MT']),
    ]),
    m('fronx', 'Fronx', 'SUV', 2023, null, [
      p('PETROL', 'MANUAL', 1197, 5, ['Sigma', 'Delta', 'Delta+']),
      p('PETROL', 'AUTOMATIC', 1197, 5, ['Delta AMT', 'Delta+ AMT']),
      p('PETROL', 'MANUAL', 998, 5, ['Zeta Turbo', 'Alpha Turbo']),
      p('PETROL', 'AUTOMATIC', 998, 5, ['Zeta Turbo AT', 'Alpha Turbo AT']),
      p('CNG', 'MANUAL', 1197, 5, ['Delta CNG']),
    ]),
    m('jimny', 'Jimny', 'SUV', 2023, null, [
      p('PETROL', 'MANUAL', 1462, 5, ['Zeta', 'Alpha']),
      p('PETROL', 'AUTOMATIC', 1462, 5, ['Zeta AT', 'Alpha AT']),
    ]),
    m('gypsy', 'Gypsy', 'SUV', 1985, 2019, [
      p('PETROL', 'MANUAL', 1298, 7, ['King MPI', 'King Soft Top', 'King Hard Top']),
    ]),
    m('omni', 'Omni', 'MUV', 1984, 2019, [
      p('PETROL', 'MANUAL', 796, 8, ['5 Seater', '8 Seater', 'E MPI Cargo']),
      p('LPG', 'MANUAL', 796, 5, ['LPG']),
    ]),
    m('esteem', 'Esteem', 'SEDAN', 1994, 2008, [
      p('PETROL', 'MANUAL', 1298, 5, ['LX', 'LXi', 'VXi']),
    ]),
  ]),

  make('hyundai', 'Hyundai', 95, [
    m('eon', 'Eon', 'HATCHBACK', 2011, 2019, [
      p('PETROL', 'MANUAL', 814, 5, ['D-Lite', 'Era', 'Magna', 'Sportz', 'Magna+', 'Sportz (O)']),
      p('PETROL', 'MANUAL', 1086, 5, ['1.0 Magna+', '1.0 Sportz']),
      p('LPG', 'MANUAL', 814, 5, ['Era LPG', 'Magna LPG']),
    ]),
    m('santro', 'Santro', 'HATCHBACK', 2018, 2022, [
      p('PETROL', 'MANUAL', 1086, 5, ['D-Lite', 'Era', 'Magna', 'Sportz', 'Asta']),
      p('PETROL', 'AUTOMATIC', 1086, 5, ['Magna AMT', 'Sportz AMT']),
      p('CNG', 'MANUAL', 1086, 5, ['Magna CNG', 'Sportz CNG']),
    ]),
    m('santro-xing', 'Santro Xing', 'HATCHBACK', 2003, 2014, [
      p('PETROL', 'MANUAL', 1086, 5, ['GL', 'GLS', 'XL', 'XO', 'GL Plus']),
      p('LPG', 'MANUAL', 1086, 5, ['GL LPG']),
    ]),
    m('i10', 'i10', 'HATCHBACK', 2007, 2017, [
      p('PETROL', 'MANUAL', 1086, 5, ['Era', 'Magna', 'Sportz', 'Asta']),
      p('PETROL', 'AUTOMATIC', 1197, 5, ['Sportz AT', 'Asta AT']),
      p('PETROL', 'MANUAL', 1197, 5, ['Magna 1.2', 'Sportz 1.2', 'Asta 1.2']),
    ]),
    m('grand-i10', 'Grand i10', 'HATCHBACK', 2013, 2020, [
      p('PETROL', 'MANUAL', 1197, 5, ['Era', 'Magna', 'Sportz', 'Asta']),
      p('PETROL', 'AUTOMATIC', 1197, 5, ['Magna AT', 'Sportz AT']),
      p('DIESEL', 'MANUAL', 1186, 5, ['Era CRDi', 'Magna CRDi', 'Sportz CRDi', 'Asta CRDi']),
      p('CNG', 'MANUAL', 1197, 5, ['Magna CNG', 'Sportz CNG']),
    ]),
    m('grand-i10-nios', 'Grand i10 Nios', 'HATCHBACK', 2019, null, [
      p('PETROL', 'MANUAL', 1197, 5, ['Era', 'Magna', 'Sportz', 'Asta']),
      p('PETROL', 'AUTOMATIC', 1197, 5, ['Magna AMT', 'Sportz AMT', 'Asta AMT']),
      p('DIESEL', 'MANUAL', 1186, 5, ['Magna CRDi', 'Sportz CRDi', 'Asta CRDi']),
      p('CNG', 'MANUAL', 1197, 5, ['Magna CNG', 'Sportz CNG']),
    ]),
    m('i20', 'i20', 'HATCHBACK', 2008, null, [
      p('PETROL', 'MANUAL', 1197, 5, ['Era', 'Magna', 'Sportz', 'Asta', 'Asta (O)']),
      p('PETROL', 'AUTOMATIC', 1197, 5, ['Magna IVT', 'Sportz IVT', 'Asta IVT']),
      p('PETROL', 'AUTOMATIC', 998, 5, ['Sportz Turbo DCT', 'Asta (O) Turbo DCT']),
      p('PETROL', 'MANUAL', 998, 5, ['N Line N6', 'N Line N8']),
      p('DIESEL', 'MANUAL', 1396, 5, ['Era CRDi', 'Magna CRDi', 'Sportz CRDi', 'Asta CRDi']),
    ]),
    m('i20-active', 'i20 Active', 'HATCHBACK', 2015, 2020, [
      p('PETROL', 'MANUAL', 1197, 5, ['S', 'SX', 'SX (O)']),
      p('DIESEL', 'MANUAL', 1396, 5, ['S Diesel', 'SX Diesel', 'SX (O) Diesel']),
    ]),
    m('xcent', 'Xcent', 'SEDAN', 2014, 2020, [
      p('PETROL', 'MANUAL', 1197, 5, ['Base', 'S', 'SX', 'SX (O)']),
      p('PETROL', 'AUTOMATIC', 1197, 5, ['S AT', 'SX AT']),
      p('DIESEL', 'MANUAL', 1186, 5, ['Base CRDi', 'S CRDi', 'SX CRDi']),
    ]),
    m('aura', 'Aura', 'SEDAN', 2020, null, [
      p('PETROL', 'MANUAL', 1197, 5, ['E', 'S', 'SX', 'SX (O)']),
      p('PETROL', 'AUTOMATIC', 1197, 5, ['S AMT', 'SX AMT']),
      p('DIESEL', 'MANUAL', 1186, 5, ['E CRDi', 'S CRDi', 'SX CRDi']),
      p('CNG', 'MANUAL', 1197, 5, ['S CNG', 'SX CNG']),
    ]),
    m('verna', 'Verna', 'SEDAN', 2006, null, [
      p('PETROL', 'MANUAL', 1497, 5, ['EX', 'S', 'SX', 'SX (O)']),
      p('PETROL', 'AUTOMATIC', 1497, 5, ['S IVT', 'SX IVT', 'SX (O) IVT']),
      p('PETROL', 'AUTOMATIC', 1482, 5, ['SX (O) Turbo DCT']),
      p('DIESEL', 'MANUAL', 1493, 5, ['E CRDi', 'S CRDi', 'SX CRDi', 'SX (O) CRDi']),
      p('DIESEL', 'AUTOMATIC', 1582, 5, ['1.6 SX (O) AT']),
      p('DIESEL', 'MANUAL', 1582, 5, ['1.6 SX (O)']),
    ]),
    m('fluidic-verna', 'Fluidic Verna', 'SEDAN', 2011, 2017, [
      p('PETROL', 'MANUAL', 1591, 5, ['1.6 VTVT S', '1.6 VTVT SX']),
      p('DIESEL', 'MANUAL', 1582, 5, ['1.6 CRDi S', '1.6 CRDi SX']),
    ]),
    m('elantra', 'Elantra', 'SEDAN', 2012, 2022, [
      p('PETROL', 'MANUAL', 1999, 5, ['S', 'SX']),
      p('PETROL', 'AUTOMATIC', 1999, 5, ['SX AT', 'SX (O) AT']),
      p('DIESEL', 'MANUAL', 1582, 5, ['S CRDi', 'SX CRDi']),
      p('DIESEL', 'AUTOMATIC', 1582, 5, ['SX (O) CRDi AT']),
    ]),
    m('sonata', 'Sonata', 'LUXURY', 2001, 2014, [
      p('PETROL', 'AUTOMATIC', 2359, 5, ['2.4 GDi AT']),
      p('PETROL', 'MANUAL', 1998, 5, ['Embera 2.0']),
    ]),
    m('venue', 'Venue', 'SUV', 2019, null, [
      p('PETROL', 'MANUAL', 1197, 5, ['E', 'S', 'S+']),
      p('PETROL', 'MANUAL', 998, 5, ['SX Turbo', 'SX (O) Turbo', 'S (O) Turbo']),
      p('PETROL', 'AUTOMATIC', 998, 5, ['SX Turbo DCT', 'SX (O) Turbo DCT', 'N Line N8 DCT']),
      p('DIESEL', 'MANUAL', 1493, 5, ['S CRDi', 'SX CRDi', 'SX (O) CRDi']),
    ]),
    m('exter', 'Exter', 'SUV', 2023, null, [
      p('PETROL', 'MANUAL', 1197, 5, ['EX', 'S', 'SX', 'SX (O)']),
      p('PETROL', 'AUTOMATIC', 1197, 5, ['S AMT', 'SX AMT', 'SX (O) AMT']),
      p('CNG', 'MANUAL', 1197, 5, ['S CNG', 'SX CNG']),
    ]),
    m('creta', 'Creta', 'SUV', 2015, null, [
      p('PETROL', 'MANUAL', 1497, 5, ['E', 'EX', 'S', 'SX']),
      p('PETROL', 'AUTOMATIC', 1497, 5, ['S IVT', 'SX IVT', 'SX (O) IVT']),
      p('PETROL', 'AUTOMATIC', 1482, 5, ['SX (O) Turbo DCT', 'N Line N8 DCT']),
      p('DIESEL', 'MANUAL', 1493, 5, ['E CRDi', 'S CRDi', 'SX CRDi', 'SX (O) CRDi']),
      p('DIESEL', 'AUTOMATIC', 1493, 5, ['SX CRDi AT', 'SX (O) CRDi AT']),
      p('DIESEL', 'MANUAL', 1582, 5, ['1.6 S', '1.6 SX', '1.6 SX (O)']),
      p('DIESEL', 'AUTOMATIC', 1582, 5, ['1.6 SX (O) AT']),
    ]),
    m('alcazar', 'Alcazar', 'SUV', 2021, null, [
      p('PETROL', 'MANUAL', 1999, 7, ['Prestige', 'Platinum']),
      p('PETROL', 'AUTOMATIC', 1482, 7, ['Platinum Turbo DCT', 'Signature Turbo DCT']),
      p('DIESEL', 'MANUAL', 1493, 7, ['Prestige CRDi', 'Platinum CRDi', 'Signature CRDi']),
      p('DIESEL', 'AUTOMATIC', 1493, 7, ['Platinum CRDi AT', 'Signature CRDi AT']),
    ]),
    m('tucson', 'Tucson', 'SUV', 2016, null, [
      p('PETROL', 'AUTOMATIC', 1999, 5, ['GL AT', 'Platinum AT', 'Signature AT']),
      p('DIESEL', 'AUTOMATIC', 1998, 5, ['GLS AT', 'Platinum AT Diesel', 'Signature AWD']),
    ]),
    m('santa-fe', 'Santa Fe', 'SUV', 2010, 2017, [
      p('DIESEL', 'MANUAL', 2199, 7, ['2WD MT']),
      p('DIESEL', 'AUTOMATIC', 2199, 7, ['2WD AT', '4WD AT']),
    ]),
    m('kona-electric', 'Kona Electric', 'SUV', 2019, 2023, [
      p('ELECTRIC', 'AUTOMATIC', null, 5, ['Premium', 'Premium Dual Tone']),
    ]),
    m('ioniq-5', 'Ioniq 5', 'SUV', 2023, null, [p('ELECTRIC', 'AUTOMATIC', null, 5, ['Base'])]),
    m('accent', 'Accent', 'SEDAN', 1999, 2013, [
      p('PETROL', 'MANUAL', 1495, 5, ['GLE', 'GLS', 'Executive', 'Viva']),
      p('CNG', 'MANUAL', 1495, 5, ['GLE CNG']),
    ]),
    m('getz', 'Getz', 'HATCHBACK', 2004, 2010, [
      p('PETROL', 'MANUAL', 1341, 5, ['GLE', 'GLS', 'GVS']),
      p('DIESEL', 'MANUAL', 1493, 5, ['Prime CRDi']),
    ]),
  ]),

  make('tata', 'Tata', 90, [
    m('nano', 'Nano', 'HATCHBACK', 2009, 2018, [
      p('PETROL', 'MANUAL', 624, 4, ['Std', 'CX', 'LX', 'XM', 'XT', 'GenX XE']),
      p('PETROL', 'AUTOMATIC', 624, 4, ['GenX XTA', 'GenX XMA']),
    ]),
    m('indica', 'Indica', 'HATCHBACK', 1998, 2018, [
      p('DIESEL', 'MANUAL', 1396, 5, ['eV2 LS', 'eV2 LX', 'V2 DLS', 'V2 DLE', 'Vista LS']),
      p('PETROL', 'MANUAL', 1172, 5, ['Vista Aura', 'Vista Aqua']),
    ]),
    m('indigo', 'Indigo', 'SEDAN', 2002, 2018, [
      p('DIESEL', 'MANUAL', 1396, 5, ['eCS LS', 'eCS LX', 'eCS VX', 'CS GLS']),
      p('PETROL', 'MANUAL', 1193, 5, ['eCS GLS', 'Manza Aura']),
    ]),
    m('manza', 'Manza', 'SEDAN', 2009, 2016, [
      p('DIESEL', 'MANUAL', 1248, 5, ['Aqua', 'Aura', 'Aura+', 'Club Class Aqua']),
      p('PETROL', 'MANUAL', 1368, 5, ['Aqua Safire', 'Aura Safire']),
    ]),
    m('bolt', 'Bolt', 'HATCHBACK', 2015, 2019, [
      p('PETROL', 'MANUAL', 1193, 5, ['XE', 'XM', 'XMS', 'XT']),
      p('DIESEL', 'MANUAL', 1248, 5, ['XE Quadrajet', 'XM Quadrajet', 'XT Quadrajet']),
    ]),
    m('zest', 'Zest', 'SEDAN', 2014, 2019, [
      p('PETROL', 'MANUAL', 1193, 5, ['XE', 'XM', 'XMS', 'XT']),
      p('DIESEL', 'MANUAL', 1248, 5, ['XE Quadrajet', 'XM Quadrajet', 'XT Quadrajet']),
      p('DIESEL', 'AUTOMATIC', 1248, 5, ['XMA Quadrajet']),
    ]),
    m('tiago', 'Tiago', 'HATCHBACK', 2016, null, [
      p('PETROL', 'MANUAL', 1199, 5, ['XE', 'XM', 'XT', 'XZ', 'XZ+', 'XTA', 'XZA+']),
      p('PETROL', 'AUTOMATIC', 1199, 5, ['XTA AMT', 'XZA AMT', 'XZA+ AMT']),
      p('DIESEL', 'MANUAL', 1047, 5, ['XE Diesel', 'XM Diesel', 'XT Diesel', 'XZ Diesel']),
      p('CNG', 'MANUAL', 1199, 5, ['XM CNG', 'XT CNG', 'XZ+ CNG']),
    ]),
    m('tiago-ev', 'Tiago EV', 'HATCHBACK', 2022, null, [
      p('ELECTRIC', 'AUTOMATIC', null, 5, ['XE', 'XT', 'XZ+', 'XZ+ Tech Lux']),
    ]),
    m('tigor', 'Tigor', 'SEDAN', 2017, null, [
      p('PETROL', 'MANUAL', 1199, 5, ['XE', 'XM', 'XT', 'XZ', 'XZ+']),
      p('PETROL', 'AUTOMATIC', 1199, 5, ['XZA AMT', 'XZA+ AMT']),
      p('DIESEL', 'MANUAL', 1047, 5, ['XE Diesel', 'XM Diesel', 'XZ Diesel']),
      p('CNG', 'MANUAL', 1199, 5, ['XZ CNG', 'XZ+ CNG']),
    ]),
    m('tigor-ev', 'Tigor EV', 'SEDAN', 2021, null, [
      p('ELECTRIC', 'AUTOMATIC', null, 5, ['XE', 'XM', 'XZ+', 'XZ+ Lux']),
    ]),
    m('altroz', 'Altroz', 'HATCHBACK', 2020, null, [
      p('PETROL', 'MANUAL', 1199, 5, ['XE', 'XM', 'XM+', 'XT', 'XZ', 'XZ+']),
      p('PETROL', 'AUTOMATIC', 1199, 5, ['XM+ DCA', 'XT DCA', 'XZ+ DCA']),
      p('PETROL', 'MANUAL', 1199, 5, ['XZ+ Turbo', 'XT Turbo']),
      p('DIESEL', 'MANUAL', 1497, 5, [
        'XE Diesel',
        'XM Diesel',
        'XT Diesel',
        'XZ Diesel',
        'XZ+ Diesel',
      ]),
      p('CNG', 'MANUAL', 1199, 5, ['XM+ CNG', 'XZ+ CNG']),
    ]),
    m('punch', 'Punch', 'SUV', 2021, null, [
      p('PETROL', 'MANUAL', 1199, 5, ['Pure', 'Adventure', 'Accomplished', 'Creative']),
      p('PETROL', 'AUTOMATIC', 1199, 5, ['Adventure AMT', 'Accomplished AMT', 'Creative AMT']),
      p('CNG', 'MANUAL', 1199, 5, ['Pure CNG', 'Adventure CNG', 'Accomplished CNG']),
    ]),
    m('punch-ev', 'Punch EV', 'SUV', 2024, null, [
      p('ELECTRIC', 'AUTOMATIC', null, 5, ['Smart', 'Adventure', 'Empowered', 'Empowered+']),
    ]),
    m('nexon', 'Nexon', 'SUV', 2017, null, [
      p('PETROL', 'MANUAL', 1199, 5, ['XE', 'XM', 'XMA', 'XT', 'XZ', 'XZ+', 'XZ+ (O)']),
      p('PETROL', 'AUTOMATIC', 1199, 5, ['XMA AMT', 'XZA+ AMT', 'XZ+ DCA', 'XZ+ (O) DCA']),
      p('DIESEL', 'MANUAL', 1497, 5, [
        'XE Diesel',
        'XM Diesel',
        'XZ Diesel',
        'XZ+ Diesel',
        'XZ+ (O) Diesel',
      ]),
      p('DIESEL', 'AUTOMATIC', 1497, 5, ['XZA+ Diesel AMT']),
      p('CNG', 'MANUAL', 1199, 5, ['XZ+ CNG', 'XZ+ (O) CNG']),
    ]),
    m('nexon-ev', 'Nexon EV', 'SUV', 2020, null, [
      p('ELECTRIC', 'AUTOMATIC', null, 5, [
        'XM',
        'XZ+',
        'XZ+ Lux',
        'Prime XZ+',
        'Max XZ+',
        'Max XZ+ Lux',
      ]),
    ]),
    m('curvv', 'Curvv', 'SUV', 2024, null, [
      p('PETROL', 'MANUAL', 1199, 5, ['Smart', 'Pure', 'Creative', 'Accomplished']),
      p('PETROL', 'AUTOMATIC', 1199, 5, ['Creative DCA', 'Accomplished DCA']),
      p('DIESEL', 'MANUAL', 1497, 5, ['Pure Diesel', 'Creative Diesel', 'Accomplished Diesel']),
    ]),
    m('curvv-ev', 'Curvv EV', 'SUV', 2024, null, [
      p('ELECTRIC', 'AUTOMATIC', null, 5, ['Creative', 'Accomplished', 'Empowered+']),
    ]),
    m('harrier', 'Harrier', 'SUV', 2019, null, [
      p('DIESEL', 'MANUAL', 1956, 5, ['XE', 'XM', 'XT', 'XT+', 'XZ', 'XZ+']),
      p('DIESEL', 'AUTOMATIC', 1956, 5, ['XMA AT', 'XZA AT', 'XZA+ AT', 'XZ+ Dark AT']),
    ]),
    m('safari', 'Safari', 'SUV', 2021, null, [
      p('DIESEL', 'MANUAL', 1956, 7, ['XE', 'XM', 'XT', 'XT+', 'XZ', 'XZ+']),
      p('DIESEL', 'AUTOMATIC', 1956, 7, ['XMA AT', 'XZA AT', 'XZA+ AT', 'XZ+ Adventure AT']),
    ]),
    m('safari-storme', 'Safari Storme', 'SUV', 2012, 2019, [
      p('DIESEL', 'MANUAL', 2179, 7, ['EX', 'LX', 'VX', 'VX 4x4']),
    ]),
    m('sumo', 'Sumo', 'MUV', 1994, 2019, [
      p('DIESEL', 'MANUAL', 3000, 9, ['Gold CX', 'Gold EX', 'Gold GX', 'Grande LX']),
    ]),
    m('hexa', 'Hexa', 'MUV', 2017, 2020, [
      p('DIESEL', 'MANUAL', 2179, 7, ['XE', 'XM', 'XT', 'XT 4x4']),
      p('DIESEL', 'AUTOMATIC', 2179, 7, ['XMA AT', 'XTA AT']),
    ]),
    m('aria', 'Aria', 'MUV', 2010, 2016, [
      p('DIESEL', 'MANUAL', 2179, 7, ['Pleasure', 'Pure', 'Prestige', 'Pride 4x4']),
    ]),
    m('venture', 'Venture', 'MUV', 2010, 2017, [
      p('DIESEL', 'MANUAL', 1405, 7, ['CX', 'EX', 'GX']),
    ]),
    m('xenon', 'Xenon', 'SUV', 2009, 2020, [p('DIESEL', 'MANUAL', 2179, 5, ['XT 4x2', 'XT 4x4'])]),
  ]),

  make('mahindra', 'Mahindra', 88, [
    m('bolero', 'Bolero', 'SUV', 2000, null, [
      p('DIESEL', 'MANUAL', 1493, 7, ['B4', 'B6', 'B6 (O)']),
      p('DIESEL', 'MANUAL', 2523, 7, ['SLX', 'ZLX', 'Power+ SLE', 'Power+ SLX', 'Power+ ZLX']),
    ]),
    m('bolero-neo', 'Bolero Neo', 'SUV', 2021, null, [
      p('DIESEL', 'MANUAL', 1493, 7, ['N4', 'N8', 'N10', 'N10 (O)']),
    ]),
    m('scorpio', 'Scorpio', 'SUV', 2002, 2022, [
      p('DIESEL', 'MANUAL', 2179, 7, ['S3', 'S5', 'S7', 'S9', 'S11', 'S11 4x4']),
      p('DIESEL', 'AUTOMATIC', 2179, 7, ['S11 AT']),
      p('DIESEL', 'MANUAL', 2523, 8, ['Getaway 4x4', 'VLX', 'SLE']),
    ]),
    m('scorpio-n', 'Scorpio N', 'SUV', 2022, null, [
      p('DIESEL', 'MANUAL', 2184, 7, ['Z2', 'Z4', 'Z6', 'Z8', 'Z8 L', 'Z8 L 4x4']),
      p('DIESEL', 'AUTOMATIC', 2184, 7, ['Z4 AT', 'Z6 AT', 'Z8 AT', 'Z8 L AT']),
      p('PETROL', 'MANUAL', 1997, 7, ['Z4 Petrol', 'Z6 Petrol', 'Z8 Petrol']),
      p('PETROL', 'AUTOMATIC', 1997, 7, ['Z8 L Petrol AT']),
    ]),
    m('scorpio-classic', 'Scorpio Classic', 'SUV', 2022, null, [
      p('DIESEL', 'MANUAL', 2184, 7, ['S', 'S11']),
    ]),
    m('xuv500', 'XUV500', 'SUV', 2011, 2021, [
      p('DIESEL', 'MANUAL', 2179, 7, ['W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W11', 'W11 (O)']),
      p('DIESEL', 'AUTOMATIC', 2179, 7, ['W7 AT', 'W9 AT', 'W11 AT', 'W11 (O) AT']),
      p('PETROL', 'AUTOMATIC', 2179, 7, ['G AT']),
    ]),
    m('xuv700', 'XUV700', 'SUV', 2021, null, [
      p('DIESEL', 'MANUAL', 2184, 7, ['MX', 'AX3', 'AX5', 'AX7', 'AX7 L']),
      p('DIESEL', 'AUTOMATIC', 2184, 7, ['AX5 AT', 'AX7 AT', 'AX7 L AT', 'AX7 L AWD AT']),
      p('PETROL', 'MANUAL', 1997, 5, ['MX Petrol', 'AX3 Petrol', 'AX5 Petrol']),
      p('PETROL', 'AUTOMATIC', 1997, 7, ['AX7 Petrol AT', 'AX7 L Petrol AT']),
    ]),
    m('xuv300', 'XUV300', 'SUV', 2019, null, [
      p('PETROL', 'MANUAL', 1197, 5, ['W4', 'W6', 'W8', 'W8 (O)']),
      p('PETROL', 'AUTOMATIC', 1197, 5, ['W6 AMT', 'W8 AMT', 'W8 (O) AMT']),
      p('DIESEL', 'MANUAL', 1497, 5, ['W4 Diesel', 'W6 Diesel', 'W8 Diesel', 'W8 (O) Diesel']),
      p('DIESEL', 'AUTOMATIC', 1497, 5, ['W8 (O) Diesel AMT']),
      p('PETROL', 'MANUAL', 1197, 5, ['TurboSport W6', 'TurboSport W8']),
    ]),
    m('xuv-3xo', 'XUV 3XO', 'SUV', 2024, null, [
      p('PETROL', 'MANUAL', 1197, 5, ['MX1', 'MX2', 'MX3', 'AX5', 'AX7']),
      p('PETROL', 'AUTOMATIC', 1197, 5, ['MX3 AT', 'AX5 AT', 'AX7 AT', 'AX7 L AT']),
      p('DIESEL', 'MANUAL', 1497, 5, ['MX2 Diesel', 'MX3 Diesel', 'AX5 Diesel', 'AX7 Diesel']),
    ]),
    m('xuv400-ev', 'XUV400 EV', 'SUV', 2023, null, [
      p('ELECTRIC', 'AUTOMATIC', null, 5, ['EC Pro', 'EL Pro']),
    ]),
    m('thar', 'Thar', 'SUV', 2010, null, [
      p('DIESEL', 'MANUAL', 2184, 4, ['AX (O) 4x4', 'LX 4x4', 'AX Opt Hard Top']),
      p('DIESEL', 'AUTOMATIC', 2184, 4, ['LX 4x4 AT', 'AX (O) 4x4 AT']),
      p('PETROL', 'MANUAL', 1997, 4, ['AX (O) Petrol', 'LX Petrol 4x4']),
      p('PETROL', 'AUTOMATIC', 1997, 4, ['LX Petrol AT']),
      p('DIESEL', 'MANUAL', 2498, 7, ['CRDe 4x4', 'DI 4x4']),
    ]),
    m('thar-roxx', 'Thar Roxx', 'SUV', 2024, null, [
      p('PETROL', 'MANUAL', 1997, 5, ['MX1', 'MX3', 'AX3 L']),
      p('DIESEL', 'MANUAL', 2184, 5, ['MX3 Diesel', 'AX5 L', 'AX7 L 4x4']),
      p('DIESEL', 'AUTOMATIC', 2184, 5, ['AX7 L AT', 'AX7 L 4x4 AT']),
    ]),
    m('marazzo', 'Marazzo', 'MUV', 2018, null, [
      p('DIESEL', 'MANUAL', 1497, 8, ['M2', 'M4+', 'M6+', 'M8']),
    ]),
    m('kuv100', 'KUV100', 'SUV', 2016, 2023, [
      p('PETROL', 'MANUAL', 1198, 6, ['K2', 'K4+', 'K6+', 'K8']),
      p('DIESEL', 'MANUAL', 1198, 6, ['K2 Diesel', 'K4+ Diesel', 'K6+ Diesel', 'K8 Diesel']),
    ]),
    m('tuv300', 'TUV300', 'SUV', 2015, 2021, [
      p('DIESEL', 'MANUAL', 1493, 7, ['T4', 'T6', 'T8', 'T10']),
      p('DIESEL', 'AUTOMATIC', 1493, 7, ['T6 AMT', 'T8 AMT', 'T10 AMT']),
    ]),
    m('nuvosport', 'NuvoSport', 'SUV', 2016, 2019, [
      p('DIESEL', 'MANUAL', 1493, 7, ['N4', 'N6', 'N8']),
    ]),
    m('quanto', 'Quanto', 'SUV', 2012, 2016, [
      p('DIESEL', 'MANUAL', 1493, 7, ['C2', 'C4', 'C6', 'C8']),
    ]),
    m('xylo', 'Xylo', 'MUV', 2009, 2019, [
      p('DIESEL', 'MANUAL', 2489, 8, ['D2', 'D4', 'E4', 'E8', 'H4', 'H8', 'H9']),
    ]),
    m('verito', 'Verito', 'SEDAN', 2011, 2019, [
      p('DIESEL', 'MANUAL', 1461, 5, ['D2', 'D4', 'D6', 'Vibe D4', 'Vibe D6']),
      p('PETROL', 'MANUAL', 1390, 5, ['G4', 'G6']),
    ]),
    m('e-verito', 'e-Verito', 'SEDAN', 2016, 2021, [
      p('ELECTRIC', 'AUTOMATIC', null, 5, ['D2', 'D4', 'D6']),
    ]),
    m('alturas-g4', 'Alturas G4', 'SUV', 2018, 2022, [
      p('DIESEL', 'AUTOMATIC', 2157, 7, ['2WD AT', '4WD AT']),
    ]),
    m('be-6', 'BE 6', 'SUV', 2025, null, [
      p('ELECTRIC', 'AUTOMATIC', null, 5, ['Pack One', 'Pack Two', 'Pack Three']),
    ]),
    m('xev-9e', 'XEV 9e', 'SUV', 2025, null, [
      p('ELECTRIC', 'AUTOMATIC', null, 5, ['Pack One', 'Pack Two', 'Pack Three']),
    ]),
    m('ssangyong-rexton', 'Rexton', 'SUV', 2012, 2017, [
      p('DIESEL', 'MANUAL', 2696, 7, ['RX5 MT']),
      p('DIESEL', 'AUTOMATIC', 2696, 7, ['RX6 AT', 'RX7 AT']),
    ]),
  ]),
];
