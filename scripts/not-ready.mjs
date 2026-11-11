const [command = "command", task = "its implementation task"] = process.argv.slice(2);
console.error(`${command} is not implemented yet; see ${task} in docs/sprint/plan.md.`);
console.error("No runtime, deployment, chain operation or successful check was performed.");
process.exitCode = 2;
