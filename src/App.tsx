import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "./components/ui/textarea";
import { TypographyH1 } from "./components/TypographyH1";
import {
  Clipboard,
  Save,
  Trash2,
  RefreshCw,
  Eraser,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "motion/react";
import { TypographyH2 } from "./components/TypographyH2";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Constants
const TOAST_DURATION = 5000;
const MAX_INPUT_LENGTH = 50000;

interface SavedTable {
  id: string;
  name: string;
  input: string;
  output: string;
  createdAt: string;
}

const TableFormatter = () => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [savedTables, setSavedTables] = useState<SavedTable[]>([]);
  const [tableName, setTableName] = useState("");
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Load saved tables on component mount
  useEffect(() => {
    const loadSavedTables = () => {
      try {
        const storedTables = localStorage.getItem("formattedTables");
        if (storedTables) {
          setSavedTables(JSON.parse(storedTables));
        }
      } catch (error) {
        console.error("Error loading saved tables:", error);
        toast.error("Failed to load saved tables", {
          duration: TOAST_DURATION,
        });
      }
    };

    loadSavedTables();
  }, []);

  // Save tables to localStorage with error handling
  const saveTablestoStorage = useCallback((tables: SavedTable[]) => {
    try {
      localStorage.setItem("formattedTables", JSON.stringify(tables));
      return true;
    } catch (error) {
      console.error("Error saving to localStorage:", error);
      toast.error("Failed to save tables to storage", {
        duration: TOAST_DURATION,
      });
      return false;
    }
  }, []);

  // Format table logic extracted to avoid circular dependencies
  const formatTableText = useCallback(
    (text: string, withLineNumbers: boolean): string => {
      if (!text.trim()) {
        return "";
      }

      const entries: string[] = [];

      // First, split by line breaks to handle entries that are already separated
      const lines = text.split("\n").filter((line) => line.trim() !== "");

      for (const line of lines) {
        // Check if the line starts with a number (handles formats like "001" or "1")
        const numberPrefixMatch = line.match(
          /^\s*(\d+)(?:\s+|\.\s*|\\-\s*)(.*)/,
        );

        if (numberPrefixMatch && numberPrefixMatch[2]) {
          // Line starts with a number prefix, extract just the content part
          entries.push(numberPrefixMatch[2].trim());
        } else if (line.trim()) {
          // Just a normal line with no number prefix
          entries.push(line.trim());
        }
      }

      // If we didn't find any entries with line breaks, try to parse as a continuous string
      if (entries.length === 0) {
        // This regex will match entries that start with a number (1-999) followed by text
        const entriesRegex = /(?:^|\s)(\d{1,3})\s+((?:(?!\s+\d{1,3}\s+).)+)/g;
        let match;

        // Find all matches in the input text
        while ((match = entriesRegex.exec(text)) !== null) {
          entries.push(match[2].trim());

          // Adjust the lastIndex to avoid infinite loops
          if (match.index === entriesRegex.lastIndex) {
            entriesRegex.lastIndex++;
          }
        }
      }

      // Format with or without line numbers based on the toggle
      const formattedEntries = entries.map((entry, index) => {
        if (withLineNumbers) {
          const number = String(index + 1).padStart(3, "0");
          return `${number} ${entry}`;
        } else {
          return entry;
        }
      });

      return formattedEntries.join("\n");
    },
    [],
  );

  // Wrapper function that updates the state
  const formatTable = useCallback(
    (value?: string) => {
      const textToFormat = value !== undefined ? value : input;
      const result = formatTableText(textToFormat, showLineNumbers);
      setOutput(result);
    },
    [formatTableText, showLineNumbers],
  );

  // Reformat whenever showLineNumbers changes
  useEffect(() => {
    if (input.trim()) {
      formatTable(input);
    }
  }, [showLineNumbers, formatTable, input]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(output);
      toast.success("Copied to clipboard!", {
        duration: TOAST_DURATION,
      });
    } catch (error) {
      toast.error("Failed to copy to clipboard", {
        duration: TOAST_DURATION,
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;

    // Validate input length to prevent performance issues
    if (newValue.length > MAX_INPUT_LENGTH) {
      setInputError(
        `Input exceeds maximum length of ${MAX_INPUT_LENGTH} characters`,
      );
      return;
    }

    setInputError(null);
    setInput(newValue);
    formatTable(newValue);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Press Enter to save when input is focused
    if (e.key === "Enter") {
      e.preventDefault();
      saveToLocalStorage();
    }
  };

  const handleToggleLineNumbers = (checked: boolean | "indeterminate") => {
    // Ensure we only operate on boolean values
    const isChecked = checked === true;
    setShowLineNumbers(isChecked);
    formatTable(); // Reformat with the new setting
  };

  const clearInput = () => {
    // Store current input and output before clearing
    const previousInput = input;
    const previousOutput = output;

    // Clear the input and output
    setInput("");
    setOutput("");
    setInputError(null);

    // Show toast with undo option
    toast("Input cleared!", {
      description: "Your input has been cleared.",
      action: {
        label: "Undo",
        onClick: () => {
          // Restore the previous input and output
          setInput(previousInput);
          setOutput(previousOutput);
          toast.success("Input restored!", {
            duration: TOAST_DURATION,
          });
        },
      },
      duration: TOAST_DURATION,
    });
  };

  const saveToLocalStorage = () => {
    if (!output.trim()) {
      toast.error("Nothing to save!", {
        duration: TOAST_DURATION,
      });
      return;
    }

    if (!tableName.trim()) {
      toast.error("Please enter a name for this table", {
        duration: TOAST_DURATION,
      });
      if (nameInputRef.current) {
        nameInputRef.current.focus();
      }
      return;
    }

    // Check for duplicate names
    const isDuplicate = savedTables.some(
      (table) => table.name.toLowerCase() === tableName.toLowerCase(),
    );

    if (isDuplicate) {
      toast.error("A table with this name already exists", {
        duration: TOAST_DURATION,
      });
      return;
    }

    const newTable = {
      id: Date.now().toString(),
      name: tableName,
      input,
      output,
      createdAt: new Date().toISOString(),
    };

    const updatedTables = [...savedTables, newTable];
    const saveSuccess = saveTablestoStorage(updatedTables);

    if (saveSuccess) {
      setSavedTables(updatedTables);
      setTableName("");
      toast.success("Table saved successfully!", {
        duration: TOAST_DURATION,
      });
    }
  };

  const restoreTable = (tableData: SavedTable) => {
    setInput(tableData.input);

    // Instead of using the saved output directly, reformat with current line number setting
    const currentInput = tableData.input;
    if (currentInput.trim()) {
      formatTable(currentInput);
    }

    toast.success(`Restored table: ${tableData.name}`, {
      duration: TOAST_DURATION,
    });
  };

  const confirmDeleteTable = (id: string) => {
    setTableToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirmed = () => {
    if (!tableToDelete) return;

    // Find the table to be deleted and store it
    const tableToDeleteData = savedTables.find(
      (table) => table.id === tableToDelete,
    );
    if (tableToDeleteData) {
      // Store the deleted table
      const deletedTable = { ...tableToDeleteData };

      // Remove from saved tables
      const updatedTables = savedTables.filter(
        (table) => table.id !== tableToDelete,
      );
      const saveSuccess = saveTablestoStorage(updatedTables);

      if (saveSuccess) {
        setSavedTables(updatedTables);

        // Show toast with undo option
        toast("Table deleted!", {
          description: `"${deletedTable.name}" has been removed.`,
          action: {
            label: "Undo",
            onClick: () => {
              // Add the deleted table back to the saved tables
              const newUpdatedTables = [...updatedTables, deletedTable];
              const restoreSuccess = saveTablestoStorage(newUpdatedTables);

              if (restoreSuccess) {
                setSavedTables(newUpdatedTables);
                toast.success(`Restored: ${deletedTable.name}`, {
                  duration: TOAST_DURATION,
                });
              }
            },
          },
          duration: TOAST_DURATION,
        });
      }
    }

    // Reset state
    setTableToDelete(null);
    setIsDeleteDialogOpen(false);
  };

  const handleDeleteCancelled = () => {
    setTableToDelete(null);
    setIsDeleteDialogOpen(false);
  };

  return (
    <div className="min-h-svh p-4 bg-white">
      <div className="w-full mx-auto">
        <TypographyH1>Random Table Formatter</TypographyH1>
        <div className="flex flex-col md:flex-row gap-4 items-end mt-6">
          <div className="w-full md:w-1/2">
            <Textarea
              className={`w-full min-h-96 ${inputError ? "border-red-500" : ""}`}
              value={input}
              onChange={handleInputChange}
              placeholder="Paste your random table here..."
              aria-label="Input text for formatting"
              aria-invalid={inputError ? "true" : "false"}
              aria-describedby={inputError ? "input-error" : undefined}
            />
            {inputError && (
              <div
                id="input-error"
                className="text-red-500 text-sm mt-1 flex items-center"
              >
                <AlertTriangle className="h-4 w-4 mr-1" />
                {inputError}
              </div>
            )}
          </div>
          <div className="w-full md:w-1/2">
            <Textarea
              className="w-full min-h-96"
              value={output}
              readOnly
              placeholder="Formatted output will appear here..."
              aria-label="Formatted output"
            />
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-4 justify-between mt-4">
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative">
              <Input
                ref={nameInputRef}
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                onKeyDown={handleNameKeyDown}
                placeholder="Enter table name..."
                className="w-64 pr-10"
                aria-label="Table name"
              />
            </div>
            <Button
              onClick={saveToLocalStorage}
              variant="outline"
              aria-label="Save table"
            >
              <Save className="mr-2 h-4 w-4" />
              Save Table
            </Button>

            {/* Clear input button */}
            <Button
              onClick={clearInput}
              variant="outline"
              className="ml-2"
              aria-label="Clear input"
            >
              <Eraser className="mr-2 h-4 w-4" />
              Clear
            </Button>

            {/* Line number toggle checkbox */}
            <div className="flex items-center ml-4 space-x-2">
              <Checkbox
                id="showLineNumbers"
                checked={showLineNumbers}
                onCheckedChange={handleToggleLineNumbers}
                aria-label="Show line numbers"
              />
              <label
                htmlFor="showLineNumbers"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Show line numbers
              </label>
            </div>
          </div>
          <Button
            onClick={copyToClipboard}
            disabled={!output}
            aria-label="Copy to clipboard"
          >
            <Clipboard className="mr-2 h-4 w-4" />
            Copy to Clipboard
          </Button>
        </div>

        {/* Saved Tables Section with optimized AnimatePresence */}
        {savedTables.length > 0 && (
          <div className="mt-8">
            <TypographyH2>Saved Tables</TypographyH2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              <AnimatePresence initial={false}>
                {savedTables.map((table, index) => (
                  <motion.div
                    key={table.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      transition: {
                        delay: Math.min(index * 0.05, 0.3), // Cap staggered delay
                        duration: 0.15,
                      },
                    }}
                    exit={{
                      opacity: 0,
                      scale: 0.9,
                      transition: { duration: 0.15 },
                    }}
                    className="w-full"
                  >
                    <Card className="overflow-hidden h-full">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center mb-2">
                          <h3
                            className="font-medium truncate"
                            title={table.name}
                          >
                            {table.name}
                          </h3>
                          <span className="text-xs text-gray-500">
                            {new Date(table.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p
                          className="text-sm text-gray-500 mb-4 truncate"
                          title={table.input}
                        >
                          {table.input.substring(0, 50)}
                          {table.input.length > 50 ? "..." : ""}
                        </p>
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => restoreTable(table)}
                            aria-label={`Restore table ${table.name}`}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" /> Restore
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => confirmDeleteTable(table.id)}
                            aria-label={`Delete table ${table.name}`}
                          >
                            <Trash2 className="h-4 w-4 mr-1" /> Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this table? This action can be
                undone for a short time after deletion.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleDeleteCancelled}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirmed}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default TableFormatter;
