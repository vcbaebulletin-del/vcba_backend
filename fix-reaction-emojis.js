/**
 * Script to fix reaction emojis in the database
 */

const mysql = require('mysql2/promise');

// Railway database configuration
const railwayConfig = {
  host: 'centerbeam.proxy.rlwy.net',
  port: 14376,
  user: 'root',
  password: 'TtTMjTElsEGhDREYyaIBcNyjbQGajuqi',
  database: 'railway',
  charset: 'utf8mb4'
};

async function fixReactionEmojis() {
  let connection;
  
  try {
    console.log('='.repeat(70));
    console.log('  FIXING REACTION EMOJIS');
    console.log('='.repeat(70));
    console.log('');
    
    console.log('🔄 Connecting to Railway database...');
    connection = await mysql.createConnection(railwayConfig);
    console.log('✅ Connected successfully!');
    console.log('');
    
    // Check reaction_types table
    console.log('📋 Checking reaction_types table...');
    console.log('-'.repeat(70));
    const [reactionTypes] = await connection.execute(
      `SELECT reaction_id, reaction_name, reaction_emoji
       FROM reaction_types`
    );

    console.log('Current reaction types:');
    reactionTypes.forEach(rt => {
      console.log(`   ID: ${rt.reaction_id} | Name: ${rt.reaction_name.padEnd(10)} | Emoji: ${rt.reaction_emoji} | Hex: ${Buffer.from(rt.reaction_emoji).toString('hex')}`);
    });
    console.log('');

    // Fix reaction emojis
    console.log('🔧 Fixing reaction emojis...');
    console.log('-'.repeat(70));

    const correctEmojis = {
      'like': '👍',
      'love': '❤️',
      'laugh': '😂',
      'wow': '😮',
      'sad': '😢',
      'angry': '😠'
    };

    for (const rt of reactionTypes) {
      const correctEmoji = correctEmojis[rt.reaction_name.toLowerCase()];
      if (correctEmoji && rt.reaction_emoji !== correctEmoji) {
        try {
          await connection.execute(
            `UPDATE reaction_types
             SET reaction_emoji = ?
             WHERE reaction_id = ?`,
            [correctEmoji, rt.reaction_id]
          );
          console.log(`   ✅ Updated ${rt.reaction_name}: ${rt.reaction_emoji} → ${correctEmoji}`);
        } catch (error) {
          console.log(`   ❌ Failed to update ${rt.reaction_name}: ${error.message}`);
        }
      } else {
        console.log(`   ℹ️  ${rt.reaction_name} already correct: ${rt.reaction_emoji}`);
      }
    }
    console.log('');

    // Verify changes
    console.log('✔️  Verifying changes...');
    console.log('-'.repeat(70));
    const [updatedReactionTypes] = await connection.execute(
      `SELECT reaction_id, reaction_name, reaction_emoji
       FROM reaction_types`
    );

    console.log('Updated reaction types:');
    updatedReactionTypes.forEach(rt => {
      console.log(`   ID: ${rt.reaction_id} | Name: ${rt.reaction_name.padEnd(10)} | Emoji: ${rt.reaction_emoji}`);
    });
    console.log('');
    
    console.log('='.repeat(70));
    console.log('  ✅ REACTION EMOJIS FIXED');
    console.log('='.repeat(70));
    console.log('');
    console.log('Summary:');
    console.log('  ✅ Reaction emojis updated in database');
    console.log('  ✅ New reaction notifications will display correctly');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('❌ ERROR:', error.message);
    console.error('');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
      console.log('');
    }
  }
}

// Run the fix
console.log('');
fixReactionEmojis();

