export const KNOWN_TOOL_NAMES = new Set(["read_file", "edit", "multi_edit", "write_to_file", "run_command", "grep_search", "find_by_name", "list_dir", "code_search", "command_status", "browser_preview", "todo_list", "ask_user_question", "deploy_web_app", "read_deployment_config", "check_deploy_status", "create_memory", "search_web", "read_url_content", "view_content_chunk", "skill", "edit_notebook", "read_notebook", "trajectory_search", "read_resource", "list_resources", "read_terminal"]);
export function normalizeToolInvocation(_0x81cab4, _0x193806) {
  let _0x1b29d6 = _0x81cab4;
  const _0x33d0cc = normalizeToolArguments(_0x193806);
  const _0x308fea = {
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
  _0x1b29d6 = _0x308fea[_0x1b29d6] || _0x1b29d6;
  if (_0x1b29d6 === "read_file") {
    remapKey(_0x33d0cc, "target_file", "file_path");
    remapKey(_0x33d0cc, "path", "file_path");
    remapKey(_0x33d0cc, "TargetFile", "file_path");
  }
  if (_0x1b29d6 === "list_dir") {
    remapKey(_0x33d0cc, "directory", "DirectoryPath");
    remapKey(_0x33d0cc, "path", "DirectoryPath");
  }
  if (_0x1b29d6 === "code_search") {
    remapKey(_0x33d0cc, "query", "search_term");
    remapKey(_0x33d0cc, "prompt", "search_term");
    remapKey(_0x33d0cc, "path", "search_folder_absolute_uri");
    remapKey(_0x33d0cc, "directory", "search_folder_absolute_uri");
    remapKey(_0x33d0cc, "SearchPath", "search_folder_absolute_uri");
  }
  if (_0x1b29d6 === "grep_search") {
    remapKey(_0x33d0cc, "path", "SearchPath");
    remapKey(_0x33d0cc, "directory", "SearchPath");
    remapKey(_0x33d0cc, "query", "Query");
    remapKey(_0x33d0cc, "pattern", "Query");
    remapArrayKey(_0x33d0cc, "include", "Includes");
    remapArrayKey(_0x33d0cc, "includes", "Includes");
  }
  if (_0x1b29d6 === "run_command") {
    remapKey(_0x33d0cc, "command", "CommandLine");
    remapKey(_0x33d0cc, "cmd", "CommandLine");
    remapKey(_0x33d0cc, "cwd", "Cwd");
    remapKey(_0x33d0cc, "working_directory", "Cwd");
    remapKey(_0x33d0cc, "blocking", "Blocking");
    remapKey(_0x33d0cc, "safe", "SafeToAutoRun");
  }
  if (_0x1b29d6 === "todo_list") {
    if (_0x33d0cc.items !== undefined && _0x33d0cc.todos === undefined) {
      const _0x50ccd6 = Array.isArray(_0x33d0cc.items) ? _0x33d0cc.items : String(_0x33d0cc.items).split(/[,，]/).map(_0x7581ed => _0x7581ed.trim()).filter(Boolean);
      _0x33d0cc.todos = _0x50ccd6.map((_0x31dedd, _0x517b65) => ({
        id: String(_0x517b65 + 1),
        content: typeof _0x31dedd === "string" ? _0x31dedd : _0x31dedd.content || _0x31dedd.text || String(_0x31dedd),
        priority: "medium",
        status: "pending"
      }));
      delete _0x33d0cc.items;
    }
    if (_0x33d0cc.tasks !== undefined && _0x33d0cc.todos === undefined) {
      _0x33d0cc.todos = Array.isArray(_0x33d0cc.tasks) ? _0x33d0cc.tasks : [];
      delete _0x33d0cc.tasks;
    }
    if (Array.isArray(_0x33d0cc.todos)) {
      _0x33d0cc.todos = _0x33d0cc.todos.map((_0x5981f5, _0x4dc0d0) => {
        if (typeof _0x5981f5 === "string") {
          return {
            id: String(_0x4dc0d0 + 1),
            content: _0x5981f5,
            priority: "medium",
            status: "pending"
          };
        }
        if (typeof _0x5981f5 === "object" && _0x5981f5 !== null) {
          return {
            id: _0x5981f5.id || String(_0x4dc0d0 + 1),
            content: _0x5981f5.content || _0x5981f5.text || _0x5981f5.title || String(_0x5981f5),
            priority: _0x5981f5.priority || "medium",
            status: _0x5981f5.status || "pending"
          };
        }
        return {
          id: String(_0x4dc0d0 + 1),
          content: String(_0x5981f5),
          priority: "medium",
          status: "pending"
        };
      });
    }
    delete _0x33d0cc.operation;
  }
  if (_0x1b29d6 === "write_to_file") {
    remapKey(_0x33d0cc, "file_path", "TargetFile");
    remapKey(_0x33d0cc, "path", "TargetFile");
    remapKey(_0x33d0cc, "target_file", "TargetFile");
    remapKey(_0x33d0cc, "content", "CodeContent");
    remapKey(_0x33d0cc, "code", "CodeContent");
    remapKey(_0x33d0cc, "text", "CodeContent");
    if (_0x33d0cc.EmptyFile === undefined) {
      _0x33d0cc.EmptyFile = false;
    }
  }
  if (_0x1b29d6 === "ask_user_question") {
    remapKey(_0x33d0cc, "question_text", "question");
    remapKey(_0x33d0cc, "prompt", "question");
    remapKey(_0x33d0cc, "message", "question");
    remapKey(_0x33d0cc, "choices", "options");
    remapKey(_0x33d0cc, "allow_multiple", "allowMultiple");
    remapKey(_0x33d0cc, "multi", "allowMultiple");
    remapKey(_0x33d0cc, "multiple", "allowMultiple");
  }
  if (_0x1b29d6 === "edit") {
    remapKey(_0x33d0cc, "path", "file_path");
    remapKey(_0x33d0cc, "target_file", "file_path");
    remapKey(_0x33d0cc, "search", "old_string");
    remapKey(_0x33d0cc, "replace", "new_string");
    remapKey(_0x33d0cc, "description", "explanation");
  }
  if (_0x1b29d6 === "multi_edit") {
    remapKey(_0x33d0cc, "path", "file_path");
    remapKey(_0x33d0cc, "target_file", "file_path");
    remapKey(_0x33d0cc, "description", "explanation");
  }
  if (_0x1b29d6 === "find_by_name") {
    remapKey(_0x33d0cc, "path", "SearchDirectory");
    remapKey(_0x33d0cc, "directory", "SearchDirectory");
    remapKey(_0x33d0cc, "pattern", "Pattern");
    remapKey(_0x33d0cc, "type", "Type");
  }
  if (_0x1b29d6 === "browser_preview") {
    remapKey(_0x33d0cc, "title", "Name");
    remapKey(_0x33d0cc, "name", "Name");
    remapKey(_0x33d0cc, "url", "Url");
  }
  if (_0x1b29d6 === "search_web") {
    remapKey(_0x33d0cc, "q", "query");
    remapKey(_0x33d0cc, "term", "query");
    remapKey(_0x33d0cc, "site", "domain");
  }
  const _0x4ab1a2 = normalizeToolParams(_0x1b29d6, _0x33d0cc);
  const _0x274667 = {
    toolName: _0x1b29d6,
    params: _0x4ab1a2
  };
  return _0x274667;
}
export function normalizeToolArguments(_0xc4b9ad) {
  if (_0xc4b9ad == null) {
    return {};
  }
  if (typeof _0xc4b9ad === "string") {
    const _0x1b4a2b = _0xc4b9ad.trim();
    const _0xf80750 = _0x1b4a2b.startsWith("{") && _0x1b4a2b.endsWith("}") || _0x1b4a2b.startsWith("[") && _0x1b4a2b.endsWith("]");
    if (_0xf80750) {
      try {
        return normalizeToolArguments(JSON.parse(_0x1b4a2b));
      } catch {
        return _0xc4b9ad;
      }
    }
    return _0xc4b9ad;
  }
  if (Array.isArray(_0xc4b9ad)) {
    return _0xc4b9ad.map(_0x4b4829 => normalizeToolArguments(_0x4b4829));
  }
  if (typeof _0xc4b9ad === "object") {
    const _0x572695 = {};
    for (const [_0x24d78e, _0x592395] of Object.entries(_0xc4b9ad)) {
      _0x572695[_0x24d78e] = normalizeToolArguments(_0x592395);
    }
    return _0x572695;
  }
  return _0xc4b9ad;
}
export function normalizeToolParams(_0x196bab, _0x1c8ffa) {
  if (!_0x1c8ffa || typeof _0x1c8ffa !== "object" || Array.isArray(_0x1c8ffa)) {
    return _0x1c8ffa;
  }
  const _0x401ca1 = {};
  for (const [_0x50d884, _0x328a5e] of Object.entries(_0x1c8ffa)) {
    let _0x267dc6 = _0x328a5e;
    if (typeof _0x267dc6 !== "string") {
      _0x401ca1[_0x50d884] = normalizeToolArguments(_0x267dc6);
      continue;
    }
    const _0x5ef7f4 = _0x267dc6.trim();
    if (_0x5ef7f4 === "true") {
      _0x401ca1[_0x50d884] = true;
      continue;
    }
    if (_0x5ef7f4 === "false") {
      _0x401ca1[_0x50d884] = false;
      continue;
    }
    if (_0x5ef7f4.startsWith("[") && _0x5ef7f4.endsWith("]") || _0x5ef7f4.startsWith("{") && _0x5ef7f4.endsWith("}")) {
      try {
        _0x401ca1[_0x50d884] = normalizeToolArguments(JSON.parse(_0x5ef7f4));
        continue;
      } catch {}
    }
    _0x401ca1[_0x50d884] = _0x267dc6;
  }
  if (_0x196bab === "ask_user_question" && _0x401ca1.options !== undefined) {
    _0x401ca1.options = normalizeAskUserOptions(_0x401ca1.options);
    if (_0x401ca1.allowMultiple === undefined) {
      _0x401ca1.allowMultiple = false;
    }
  }
  return _0x401ca1;
}
export function normalizeAskUserOptions(_0x4286de) {
  if (Array.isArray(_0x4286de)) {
    return _0x4286de.map(_0x4e11c7 => {
      if (typeof _0x4e11c7 === "string") {
        const _0x157b69 = _0x4e11c7.trim();
        if (!_0x157b69) {
          return null;
        }
        const _0x50c2a4 = {
          label: _0x157b69,
          description: _0x157b69
        };
        return _0x50c2a4;
      }
      if (_0x4e11c7 && typeof _0x4e11c7 === "object") {
        const _0x19f298 = String(_0x4e11c7.label || _0x4e11c7.name || _0x4e11c7.title || "").trim();
        const _0xe7c909 = String(_0x4e11c7.description || _0x4e11c7.detail || _0x19f298).trim();
        if (!_0x19f298) {
          return null;
        }
        return {
          label: _0x19f298,
          description: _0xe7c909 || _0x19f298
        };
      }
      return null;
    }).filter(Boolean);
  }
  if (typeof _0x4286de === "string") {
    return _0x4286de.split(/[|,，\n]/).map(_0x2d265e => _0x2d265e.trim()).filter(Boolean).map(_0xd38259 => ({
      label: _0xd38259,
      description: _0xd38259
    }));
  }
  return [];
}
function remapKey(_0x266648, _0x188f46, _0x5a85ce) {
  if (_0x266648[_0x188f46] !== undefined && _0x266648[_0x5a85ce] === undefined) {
    _0x266648[_0x5a85ce] = _0x266648[_0x188f46];
    delete _0x266648[_0x188f46];
  }
}
function remapArrayKey(_0x451937, _0x1c901d, _0x353381) {
  if (_0x451937[_0x1c901d] !== undefined && _0x451937[_0x353381] === undefined) {
    _0x451937[_0x353381] = Array.isArray(_0x451937[_0x1c901d]) ? _0x451937[_0x1c901d] : [_0x451937[_0x1c901d]];
    delete _0x451937[_0x1c901d];
  }
}
