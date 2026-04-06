import { ClineAgent, type PermissionHandler } from 'cline';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const ask = (q: string) => new Promise<string>((res) => rl.question(q, res));

const interactivePermissions: PermissionHandler = async (request) => {
  console.log(`\n⚠️  Permission: ${request.toolCall.title}`);

  for (const [i, opt] of request.options.entries()) {
    console.log(`  ${i + 1}. [${opt.kind}] ${opt.name}`);
  }

  const choice = await ask('Choose (number): ');
  const idx = parseInt(choice, 10) - 1;
  const selected = request.options[idx];

  if (selected) {
    return {
      outcome: { outcome: 'selected', optionId: selected.optionId },
    };
  } else {
    return { outcome: { outcome: 'cancelled' } };
  }
};

async function main() {
  const agent = new ClineAgent({});
  await agent.initialize({ protocolVersion: 1, clientCapabilities: {} });

  const { sessionId } = await agent.newSession({
    cwd: process.cwd(),
    mcpServers: [],
  });

  agent.setPermissionHandler(interactivePermissions);

  const emitter = agent.emitterForSession(sessionId);
  emitter.on('agent_message_chunk', (p) => {
    if (p.content.type === 'text') process.stdout.write(p.content.text);
  });

  // Multi-turn conversation
  while (true) {
    const userInput = await ask('\n> ');
    if (userInput === 'exit') break;

    const { stopReason } = await agent.prompt({
      sessionId,
      prompt: [{ type: 'text', text: userInput }],
    });

    console.log(`\n[${stopReason}]`);
  }

  await agent.shutdown();
  rl.close();
}

main();
