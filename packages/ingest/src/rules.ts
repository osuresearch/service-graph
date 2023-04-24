import { readFileSync } from 'fs';
import sql from 'mssql';
// import { MoleculeRules } from './generated';

type MoleculeRules = any;

/**
 * Indexing rules on molecules
 */
let rules: MoleculeRules[] = [];

export async function loadRules()
{
  let query = readFileSync(
    // TODO: Let this be an arg?
    process.env.RULES_QUERY_FILE ?? '', 
    'utf8'
  );
  
  const result = await sql.query(query);
  
  // TODO: Validate

  rules = result.recordset;
}

export function getDefaultRule(): MoleculeRules
{
  return rules.find(r => r.id == 'DEFAULT');
}

export function getRule(name: string): MoleculeRules
{
  const match = rules.find(r => r.id === name);
  if (match)
    return match;

  return getDefaultRule();
}
