export function isResponsesApiPath(arg0) {
  const tmp1 = String(arg0 || "/v1/responses").trim().toLowerCase();
  return !tmp1 || tmp1 === "/v1/responses" || tmp1.endsWith("/responses");
}

export function toChatCompletionsPath(arg0) {
  const tmp1 = String(arg0 || "/v1/responses").trim();
  if (!tmp1 || tmp1 === "/v1/responses") {
    return "/v1/chat/completions";
  }
  if (/\/responses\/?$/i.test(tmp1)) {
    return tmp1.replace(/\/responses\/?$/i, "/chat/completions");
  }
  if (tmp1.includes("/responses")) {
    return tmp1.replace("/responses", "/chat/completions");
  }
  return "/v1/chat/completions";
}

export function shouldFallbackToChatCompletions(arg0, arg1) {
  if (![400, 404, 405, 422, 500, 501, 502].includes(arg0)) {
    return false;
  }
  const tmp1 = String(arg1 || "").toLowerCase();
  return /convert_request_failed|not implemented|not_implemented|unsupported|unknown.*api|invalid.*responses|responses api|does not support|route not found|path not found|new_api_error/.test(tmp1);
}

export function toChatCompletionsMessages(arg0, arg1) {
  const tmp2 = [];
  if (arg0) {
    tmp2.push({
      role: "system",
      content: arg0
    });
  }
  for (const tmp02 of arg1) {
    if (typeof tmp02.content === "string") {
      tmp2.push({
        role: tmp02.role,
        content: tmp02.content
      });
      continue;
    }
    if (!Array.isArray(tmp02.content)) {
      tmp2.push({
        role: tmp02.role,
        content: String(tmp02.content)
      });
      continue;
    }
    if (tmp02.role === "assistant") {
      let tmp03 = "";
      const tmp04 = [];
      for (const tmp05 of tmp02.content) {
        if (tmp05.type === "text") {
          tmp03 += tmp05.text;
        } else if (tmp05.type === "tool_use" && tmp05.name) {
          tmp04.push({
            id: tmp05.id || "",
            type: "function",
            function: {
              name: tmp05.name,
              arguments: typeof tmp05.input === "string" ? tmp05.input : JSON.stringify(tmp05.input ?? {})
            }
          });
        }
      }
      const tmp12 = {
        role: "assistant",
        content: tmp03 || null
      };
      if (tmp04.length > 0) {
        tmp12.tool_calls = tmp04;
      }
      if (tmp03 || tmp04.length > 0) {
        tmp2.push(tmp12);
      }
      continue;
    }
    if (tmp02.role === "user") {
      const tmp03 = [];
      for (const tmp04 of tmp02.content) {
        if (tmp04.type === "text") {
          tmp03.push(tmp04.text);
        } else if (tmp04.type === "tool_result") {
          tmp2.push({
            role: "tool",
            tool_call_id: tmp04.tool_use_id,
            content: typeof tmp04.content === "string" ? tmp04.content : JSON.stringify(tmp04.content)
          });
        }
      }
      if (tmp03.length > 0) {
        tmp2.push({
          role: "user",
          content: tmp03.join("\n")
        });
      }
    }
  }
  return tmp2;
}
