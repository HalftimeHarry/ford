const PocketBase = require('pocketbase/cjs');

const pb = new PocketBase('https://pocketbase-production-96d3.up.railway.app');

// New bracket — 68 teams (64 + 4 play-in slots listed as combined entries)
// Play-in teams get seed 11 or 16 with a combined name
const newTeams = [
  // East
  { region: 'East', seed: 1,  name: 'Duke Blue Devils' },
  { region: 'East', seed: 2,  name: 'UConn Huskies' },
  { region: 'East', seed: 3,  name: 'Michigan State Spartans' },
  { region: 'East', seed: 4,  name: 'Kansas Jayhawks' },
  { region: 'East', seed: 5,  name: "St. John's Red Storm" },
  { region: 'East', seed: 6,  name: 'Louisville Cardinals' },
  { region: 'East', seed: 7,  name: 'UCLA Bruins' },
  { region: 'East', seed: 8,  name: 'Ohio State Buckeyes' },
  { region: 'East', seed: 9,  name: 'TCU Horned Frogs' },
  { region: 'East', seed: 10, name: 'UCF Knights' },
  { region: 'East', seed: 11, name: 'South Florida Bulls' },
  { region: 'East', seed: 12, name: 'Northern Iowa Panthers' },
  { region: 'East', seed: 13, name: 'Cal Baptist Lancers' },
  { region: 'East', seed: 14, name: 'North Dakota State Bison' },
  { region: 'East', seed: 15, name: 'Furman Paladins' },
  { region: 'East', seed: 16, name: 'Siena Saints' },
  // West
  { region: 'West', seed: 1,  name: 'Arizona Wildcats' },
  { region: 'West', seed: 2,  name: 'Purdue Boilermakers' },
  { region: 'West', seed: 3,  name: 'Gonzaga Bulldogs' },
  { region: 'West', seed: 4,  name: 'Arkansas Razorbacks' },
  { region: 'West', seed: 5,  name: 'Wisconsin Badgers' },
  { region: 'West', seed: 6,  name: 'BYU Cougars' },
  { region: 'West', seed: 7,  name: 'Miami Hurricanes' },
  { region: 'West', seed: 8,  name: 'Villanova Wildcats' },
  { region: 'West', seed: 9,  name: 'Utah State Aggies' },
  { region: 'West', seed: 10, name: 'Missouri Tigers' },
  { region: 'West', seed: 11, name: 'Texas / NC State' },  // play-in
  { region: 'West', seed: 12, name: 'High Point Panthers' },
  { region: 'West', seed: 13, name: 'Hawaii Rainbow Warriors' },
  { region: 'West', seed: 14, name: 'Kennesaw State Owls' },
  { region: 'West', seed: 15, name: 'Queens Royals' },
  { region: 'West', seed: 16, name: 'LIU Sharks' },
  // Midwest
  { region: 'Midwest', seed: 1,  name: 'Michigan Wolverines' },
  { region: 'Midwest', seed: 2,  name: 'Iowa State Cyclones' },
  { region: 'Midwest', seed: 3,  name: 'Virginia Cavaliers' },
  { region: 'Midwest', seed: 4,  name: 'Alabama Crimson Tide' },
  { region: 'Midwest', seed: 5,  name: 'Texas Tech Red Raiders' },
  { region: 'Midwest', seed: 6,  name: 'Tennessee Volunteers' },
  { region: 'Midwest', seed: 7,  name: 'Kentucky Wildcats' },
  { region: 'Midwest', seed: 8,  name: 'Georgia Bulldogs' },
  { region: 'Midwest', seed: 9,  name: 'Saint Louis Billikens' },
  { region: 'Midwest', seed: 10, name: 'Santa Clara Broncos' },
  { region: 'Midwest', seed: 11, name: 'Miami (OH) / SMU' },  // play-in
  { region: 'Midwest', seed: 12, name: 'Akron Zips' },
  { region: 'Midwest', seed: 13, name: 'Hofstra Pride' },
  { region: 'Midwest', seed: 14, name: 'Wright State Raiders' },
  { region: 'Midwest', seed: 15, name: 'Tennessee State Tigers' },
  { region: 'Midwest', seed: 16, name: 'UMBC / Howard' },  // play-in
  // South
  { region: 'South', seed: 1,  name: 'Florida Gators' },
  { region: 'South', seed: 2,  name: 'Houston Cougars' },
  { region: 'South', seed: 3,  name: 'Illinois Fighting Illini' },
  { region: 'South', seed: 4,  name: 'Nebraska Cornhuskers' },
  { region: 'South', seed: 5,  name: 'Vanderbilt Commodores' },
  { region: 'South', seed: 6,  name: 'North Carolina Tar Heels' },
  { region: 'South', seed: 7,  name: "Saint Mary's Gaels" },
  { region: 'South', seed: 8,  name: 'Clemson Tigers' },
  { region: 'South', seed: 9,  name: 'Iowa Hawkeyes' },
  { region: 'South', seed: 10, name: 'Texas A&M Aggies' },
  { region: 'South', seed: 11, name: 'VCU Rams' },
  { region: 'South', seed: 12, name: 'McNeese Cowboys' },
  { region: 'South', seed: 13, name: 'Troy Trojans' },
  { region: 'South', seed: 14, name: 'Penn Quakers' },
  { region: 'South', seed: 15, name: 'Idaho Vandals' },
  { region: 'South', seed: 16, name: 'Prairie View / Lehigh' },  // play-in
];

// Existing IDs sorted by region+seed (from current DB)
const existingIds = {
  East: {
    1: '4ksmr54uxehwcns', 2: '4yingisg1qnj2uv', 3: 'o83ppcz71h1v89p', 4: 'rlbc41o0yzzz88m',
    5: 'oa90bvokfzg0gn5', 6: '6mxfjcutazpwtrt', 7: 'zgohn24edzcf1ry', 8: '7q3z6ag39uospnn',
    9: '01uppikpo64r8jw', 10: '7ax3054207780x2', 11: 'cv36tyuacujj18m', 12: 'wxh8e8ka6mnk9yd',
    13: '1u66l8kz29y3rit', 14: 'a12c0p9y7h5ma0j', 15: 'uh9ctrfznn0dume', 16: '0cap4362xbcv270',
  },
  Midwest: {
    1: 'ven9q1940a6iljx', 2: 'myy8i1fqgiwfc3g', 3: 'w590ok0yb9e1hmu', 4: 'i9br1f7p63wj10r',
    5: 'n4mkosjrm6n9uqb', 6: '02bq9xkayproodt', 7: 'okusxagjfhua6r9', 8: '6v67zvckchgdhav',
    9: 'j055jwbr5q3trl6', 10: 'qk0fk1cgv44xfgq', 11: 'rsj20vftsqnofnl', 12: '22vhtmnvtg7sfgt',
    13: 'xjoef060bp8td54', 14: 'gc2z2922a5tkt8a', 15: 's366ogcsgmqnwq4', 16: '0h78b1zgkk1c44l',
  },
  South: {
    1: 'gysuivqdxx0se63', 2: 'c6c0o5i3e2ksxpq', 3: 'ylns44m3b0g7z72', 4: 'i3rsx5wz7tfs9i4',
    5: 'a0wp1zso5zdibyk', 6: '15qs07rfab85uyi', 7: 'gn9b5b7robpfcku', 8: 'elp31p2de45xs70',
    9: '897482mjuo8cl5y', 10: '261wh9ks6zrr5jd', 11: '8a5g27veljuzxv2', 12: 'aw3z0mt9w0sczmv',
    13: 'yzsa1rvmd0h7ver', 14: '5kxy4x8fqz9pqc5', 15: '1aijbrxqtpvi1ks', 16: 'uwx4kvgd5pfyyjk',
  },
  West: {
    1: 'hxkhvq0c4gsjm3w', 2: 'n7grf8ofdxnclkn', 3: 'wmrk4cabols01l8', 4: '076a2tzdz9o64fr',
    5: 'w6sukxiypp5xer7', 6: 'cg8crd8mji2sw5n', 7: 'q6v3010y4adjsjh', 8: 'txoftv96z4ihwxl',
    9: 'merjx72dwby79kv', 10: 'fw3ek5tek3y2sik', 11: 'm6e0myghiif2v4l', 12: '28kz1kuji31qoxo',
    13: 'zxxm29pthwf54hf', 14: 'emiwfu7wu6h7lz3', 15: 'pzsr8mo6fkz4flt', 16: '9dlsrb4vosoqgi6',
  },
};

async function run() {
  await pb.collection('_superusers').authWithPassword('ddinsmore8@gmail.com', 'MADcap(123)');
  console.log('Authenticated');

  let updated = 0, created = 0, errors = 0;

  for (const team of newTeams) {
    const id = existingIds[team.region]?.[team.seed];
    try {
      if (id) {
        await pb.collection('ncaa_teams').update(id, {
          name: team.name,
          region: team.region,
          seed: team.seed,
          eliminated_round: '',
        });
        console.log(`  ✅ updated ${team.region} #${team.seed} → ${team.name}`);
        updated++;
      } else {
        await pb.collection('ncaa_teams').create({
          name: team.name,
          region: team.region,
          seed: team.seed,
          eliminated_round: '',
        });
        console.log(`  ➕ created ${team.region} #${team.seed} → ${team.name}`);
        created++;
      }
    } catch (e) {
      console.error(`  ❌ ${team.region} #${team.seed} ${team.name}: ${e.message}`);
      errors++;
    }
  }

  console.log(`\nDone: ${updated} updated, ${created} created, ${errors} errors`);
}

run().catch(console.error);
