export const KNOWN_TOOL_NAMES = new Set(["read_file", "edit", "multi_edit", "write_to_file", "run_command", "grep_search", "find_by_name", "list_dir", "code_search", "command_status", "browser_preview", "todo_list", "ask_user_question", "deploy_web_app", "read_deployment_config", "check_deploy_status", "create_memory", "search_web", "read_url_content", "view_content_chunk", "skill", "edit_notebook", "read_notebook", "trajectory_search", "read_resource", "list_resources", "read_terminal", "do_not_call"]);
const MCP_TOOL_NAME_RE = /^mcp\d+_/i;
export function isMcpToolName(name) {
  return MCP_TOOL_NAME_RE.test(String(name || "").trim());
}
export function isAllowedToolName(name) {
  const trimmed = String(name || "").trim();
  return KNOWN_TOOL_NAMES.has(trimmed) || isMcpToolName(trimmed);
}
export function normalizeToolInvocation(arg0, arg1) {
  let tmp2 = arg0;
  const tmp3 = normalizeToolArguments(arg1);
  const tmp4 = {
    view_file: "read_file",
    open_file: "read_file",
    readFile: "read_file",
    read: "read_file",
    cat_file: "read_file",
    ls: "list_dir",
    dir: "list_dir",
    list_directory: "list_dir",
    list_files: "list_dir",
    search_code: "code_search",
    search_repo: "code_search",
    search_in_codebase: "code_search",
    grep: "grep_search",
    rg: "grep_search",
    search_text: "grep_search",
    run_terminal_command: "run_command",
    execute_command: "run_command",
    run_command_line: "run_command",
    shell_command: "run_command",
    askUserQuestion: "ask_user_question",
    ask_user: "ask_user_question",
    ask_human: "ask_user_question",
    ask_followup_question: "ask_user_question",
    update_todo_list: "todo_list",
    todo_list_create: "todo_list",
    create_todo_list: "todo_list",
    update_todos: "todo_list",
    manage_todos: "todo_list",
    write_file: "write_to_file",
    create_file: "write_to_file",
    save_file: "write_to_file",
    writeFile: "write_to_file",
    find_file: "find_by_name",
    find_files: "find_by_name",
    search_files: "find_by_name",
    edit_file: "edit",
    replace_in_file: "edit",
    web_search: "search_web",
    browser: "browser_preview"
  };
  tmp2 = tmp4[tmp2] || tmp2;
  if (tmp2 === "read_file") {
    remapKey(tmp3, "target_file", "file_path");
    remapKey(tmp3, "path", "file_path");
    remapKey(tmp3, "TargetFile", "file_path");
  }
  if (tmp2 === "list_dir") {
    remapKey(tmp3, "directory", "DirectoryPath");
    remapKey(tmp3, "path", "DirectoryPath");
  }
  if (tmp2 === "code_search") {
    remapKey(tmp3, "query", "search_term");
    remapKey(tmp3, "prompt", "search_term");
    remapKey(tmp3, "path", "search_folder_absolute_uri");
    remapKey(tmp3, "directory", "search_folder_absolute_uri");
    remapKey(tmp3, "SearchPath", "search_folder_absolute_uri");
  }
  if (tmp2 === "grep_search") {
    remapKey(tmp3, "path", "SearchPath");
    remapKey(tmp3, "directory", "SearchPath");
    remapKey(tmp3, "query", "Query");
    remapKey(tmp3, "pattern", "Query");
    remapArrayKey(tmp3, "include", "Includes");
    remapArrayKey(tmp3, "includes", "Includes");
  }
  if (tmp2 === "run_command") {
    remapKey(tmp3, "command", "CommandLine");
    remapKey(tmp3, "cmd", "CommandLine");
    remapKey(tmp3, "cwd", "Cwd");
    remapKey(tmp3, "working_directory", "Cwd");
    remapKey(tmp3, "blocking", "Blocking");
    remapKey(tmp3, "safe", "SafeToAutoRun");
  }
  if (tmp2 === "todo_list") {
    if (tmp3.items !== undefined && tmp3.todos === undefined) {
      const tmp0 = Array.isArray(tmp3.items) ? tmp3.items : String(tmp3.items).split(/[,，]/).map(arg02 => arg02.trim()).filter(Boolean);
      tmp3.todos = tmp0.map((arg02, arg12) => ({
        id: String(arg12 + 1),
        content: typeof arg02 === "string" ? arg02 : arg02.content || arg02.text || String(arg02),
        priority: "medium",
        status: "pending"
      }));
      delete tmp3.items;
    }
    if (tmp3.tasks !== undefined && tmp3.todos === undefined) {
      tmp3.todos = Array.isArray(tmp3.tasks) ? tmp3.tasks : [];
      delete tmp3.tasks;
    }
    if (Array.isArray(tmp3.todos)) {
      tmp3.todos = tmp3.todos.map((arg02, arg12) => {
        if (typeof arg02 === "string") {
          return {
            id: String(arg12 + 1),
            content: arg02,
            priority: "medium",
            status: "pending"
          };
        }
        if (typeof arg02 === "object" && arg02 !== null) {
          return {
            id: arg02.id || String(arg12 + 1),
            content: arg02.content || arg02.text || arg02.title || String(arg02),
            priority: arg02.priority || "medium",
            status: arg02.status || "pending"
          };
        }
        return {
          id: String(arg12 + 1),
          content: String(arg02),
          priority: "medium",
          status: "pending"
        };
      });
    }
    delete tmp3.operation;
  }
  if (tmp2 === "write_to_file") {
    remapKey(tmp3, "file_path", "TargetFile");
    remapKey(tmp3, "path", "TargetFile");
    remapKey(tmp3, "target_file", "TargetFile");
    remapKey(tmp3, "content", "CodeContent");
    remapKey(tmp3, "code", "CodeContent");
    remapKey(tmp3, "text", "CodeContent");
    if (tmp3.EmptyFile === undefined) {
      tmp3.EmptyFile = false;
    }
  }
  if (tmp2 === "ask_user_question") {
    remapKey(tmp3, "question_text", "question");
    remapKey(tmp3, "prompt", "question");
    remapKey(tmp3, "message", "question");
    remapKey(tmp3, "choices", "options");
    remapKey(tmp3, "allow_multiple", "allowMultiple");
    remapKey(tmp3, "multi", "allowMultiple");
    remapKey(tmp3, "multiple", "allowMultiple");
  }
  if (tmp2 === "edit") {
    remapKey(tmp3, "path", "file_path");
    remapKey(tmp3, "target_file", "file_path");
    remapKey(tmp3, "search", "old_string");
    remapKey(tmp3, "replace", "new_string");
    remapKey(tmp3, "description", "explanation");
  }
  if (tmp2 === "multi_edit") {
    remapKey(tmp3, "path", "file_path");
    remapKey(tmp3, "target_file", "file_path");
    remapKey(tmp3, "description", "explanation");
  }
  if (tmp2 === "find_by_name") {
    remapKey(tmp3, "path", "SearchDirectory");
    remapKey(tmp3, "directory", "SearchDirectory");
    remapKey(tmp3, "pattern", "Pattern");
    remapKey(tmp3, "type", "Type");
  }
  if (tmp2 === "browser_preview") {
    remapKey(tmp3, "title", "Name");
    remapKey(tmp3, "name", "Name");
    remapKey(tmp3, "url", "Url");
  }
  if (tmp2 === "search_web") {
    remapKey(tmp3, "q", "query");
    remapKey(tmp3, "term", "query");
    remapKey(tmp3, "site", "domain");
  }
  const tmp5 = normalizeToolParams(tmp2, tmp3);
  const tmp6 = {
    toolName: tmp2,
    params: tmp5
  };
  return tmp6;
}
export function normalizeToolArguments(arg0) {
  if (arg0 == null) {
    return {};
  }
  if (typeof arg0 === "string") {
    const tmp0 = arg0.trim();
    const tmp1 = tmp0.startsWith("{") && tmp0.endsWith("}") || tmp0.startsWith("[") && tmp0.endsWith("]");
    if (tmp1) {
      try {
        return normalizeToolArguments(JSON.parse(tmp0));
      } catch {
        return arg0;
      }
    }
    return arg0;
  }
  if (Array.isArray(arg0)) {
    return arg0.map(arg02 => normalizeToolArguments(arg02));
  }
  if (typeof arg0 === "object") {
    const tmp0 = {};
    for (const [tmp02, tmp1] of Object.entries(arg0)) {
      tmp0[tmp02] = normalizeToolArguments(tmp1);
    }
    return tmp0;
  }
  return arg0;
}
export function normalizeToolParams(arg0, arg1) {
  if (!arg1 || typeof arg1 !== "object" || Array.isArray(arg1)) {
    return arg1;
  }
  const tmp2 = {};
  for (const [tmp0, tmp1] of Object.entries(arg1)) {
    let tmp02 = tmp1;
    if (typeof tmp02 !== "string") {
      tmp2[tmp0] = normalizeToolArguments(tmp02);
      continue;
    }
    const tmp12 = tmp02.trim();
    if (tmp12 === "true") {
      tmp2[tmp0] = true;
      continue;
    }
    if (tmp12 === "false") {
      tmp2[tmp0] = false;
      continue;
    }
    if (tmp12.startsWith("[") && tmp12.endsWith("]") || tmp12.startsWith("{") && tmp12.endsWith("}")) {
      try {
        tmp2[tmp0] = normalizeToolArguments(JSON.parse(tmp12));
        continue;
      } catch {}
    }
    tmp2[tmp0] = tmp02;
  }
  if (arg0 === "ask_user_question" && tmp2.options !== undefined) {
    tmp2.options = normalizeAskUserOptions(tmp2.options);
    if (tmp2.allowMultiple === undefined) {
      tmp2.allowMultiple = false;
    }
  }
  return tmp2;
}
export function normalizeAskUserOptions(arg0) {
  if (Array.isArray(arg0)) {
    return arg0.map(arg02 => {
      if (typeof arg02 === "string") {
        const tmp0 = arg02.trim();
        if (!tmp0) {
          return null;
        }
        const tmp1 = {
          label: tmp0,
          description: tmp0
        };
        return tmp1;
      }
      if (arg02 && typeof arg02 === "object") {
        const tmp0 = String(arg02.label || arg02.name || arg02.title || "").trim();
        const tmp1 = String(arg02.description || arg02.detail || tmp0).trim();
        if (!tmp0) {
          return null;
        }
        return {
          label: tmp0,
          description: tmp1 || tmp0
        };
      }
      return null;
    }).filter(Boolean);
  }
  if (typeof arg0 === "string") {
    return arg0.split(/[|,，\n]/).map(arg02 => arg02.trim()).filter(Boolean).map(arg02 => ({
      label: arg02,
      description: arg02
    }));
  }
  return [];
}
function remapKey(arg0, arg1, arg2) {
  if (arg0[arg1] !== undefined && arg0[arg2] === undefined) {
    arg0[arg2] = arg0[arg1];
    delete arg0[arg1];
  }
}
function remapArrayKey(arg0, arg1, arg2) {
  if (arg0[arg1] !== undefined && arg0[arg2] === undefined) {
    arg0[arg2] = Array.isArray(arg0[arg1]) ? arg0[arg1] : [arg0[arg1]];
    delete arg0[arg1];
  }
}
